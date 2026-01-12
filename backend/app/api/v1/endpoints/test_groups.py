from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.core.database import get_db
from app.core.security import pwd_context
from app.models.test_group import TestGroup, CollectionPoint
from app.models.project import Project
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.test_group import (
    TestGroupCreate,
    TestGroupUpdate,
    TestGroupResponse,
    TestGroupConfirm,
    TestGroupCopy,
    CollectionPointCreate,
    CollectionPointUpdate,
    CollectionPointResponse,
)
from app.api.v1.endpoints.auth import get_current_user
from app.api.v1.deps import assert_project_access

router = APIRouter()


def check_test_group_permission(user: User) -> bool:
    """检查试验组管理权限"""
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]
    return user.role in allowed_roles


async def create_audit_log(
    db: AsyncSession,
    user_id: int,
    entity_type: str,
    entity_id: int,
    action: str,
    details: dict,
    reason: Optional[str] = None
):
    """创建审计日志"""
    audit_log = AuditLog(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details=details,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()


def generate_subject_numbers(prefix: str, start: int, planned: int, backup: int) -> List[str]:
    """生成受试者编号列表"""
    subjects = []
    total = planned + backup
    for i in range(total):
        num = start + i
        # 格式化为3位数字
        subjects.append(f"{prefix}{num:03d}")
    return subjects


# ==================== 试验组 CRUD ====================

@router.get("/projects/{project_id}/test-groups", response_model=List[TestGroupResponse])
async def list_test_groups(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """获取项目的试验组列表"""
    await assert_project_access(db, current_user, project_id)
    
    result = await db.execute(
        select(TestGroup)
        .where(TestGroup.project_id == project_id)
        .where(TestGroup.is_active == True)
        .order_by(TestGroup.display_order, TestGroup.id)
    )
    test_groups = result.scalars().all()
    
    # 为每个试验组生成受试者编号列表
    response = []
    for tg in test_groups:
        tg_dict = TestGroupResponse.model_validate(tg)
        if tg.subject_prefix and tg.planned_count > 0:
            tg_dict.generated_subjects = generate_subject_numbers(
                tg.subject_prefix,
                tg.subject_start_number or 1,
                tg.planned_count,
                tg.backup_count or 0
            )
        response.append(tg_dict)
    
    return response


@router.get("/test-groups/{test_group_id}", response_model=TestGroupResponse)
async def get_test_group(
    test_group_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """获取单个试验组详情"""
    result = await db.execute(
        select(TestGroup).where(TestGroup.id == test_group_id)
    )
    test_group = result.scalar_one_or_none()
    
    if not test_group or not test_group.is_active:
        raise HTTPException(status_code=404, detail="试验组不存在")
    
    await assert_project_access(db, current_user, test_group.project_id)
    
    response = TestGroupResponse.model_validate(test_group)
    if test_group.subject_prefix and test_group.planned_count > 0:
        response.generated_subjects = generate_subject_numbers(
            test_group.subject_prefix,
            test_group.subject_start_number or 1,
            test_group.planned_count,
            test_group.backup_count or 0
        )
    
    return response


@router.post("/test-groups", response_model=TestGroupResponse)
async def create_test_group(
    data: TestGroupCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """创建试验组"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限创建试验组")
    
    await assert_project_access(db, current_user, data.project_id)
    
    # 检查项目是否存在
    project_result = await db.execute(
        select(Project).where(Project.id == data.project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 转换 collection_points 为字典列表
    collection_points_data = None
    if data.collection_points:
        collection_points_data = [cp.model_dump() for cp in data.collection_points]
    
    # 转换 detection_configs 为字典列表
    detection_configs_data = None
    if data.detection_configs:
        detection_configs_data = [dc.model_dump() for dc in data.detection_configs]
    
    test_group = TestGroup(
        project_id=data.project_id,
        name=data.name,
        cycle=data.cycle,
        dosage=data.dosage,
        planned_count=data.planned_count,
        backup_count=data.backup_count,
        subject_prefix=data.subject_prefix,
        subject_start_number=data.subject_start_number,
        detection_configs=detection_configs_data,
        collection_points=collection_points_data,
        display_order=data.display_order,
        created_by=current_user.id,
    )
    
    db.add(test_group)
    await db.commit()
    await db.refresh(test_group)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="test_group",
        entity_id=test_group.id,
        action="create",
        details=data.model_dump(),
    )
    
    return test_group


@router.put("/test-groups/{test_group_id}", response_model=TestGroupResponse)
async def update_test_group(
    test_group_id: int,
    data: TestGroupUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """更新试验组"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限修改试验组")
    
    result = await db.execute(
        select(TestGroup).where(TestGroup.id == test_group_id)
    )
    test_group = result.scalar_one_or_none()
    
    if not test_group or not test_group.is_active:
        raise HTTPException(status_code=404, detail="试验组不存在")
    
    await assert_project_access(db, current_user, test_group.project_id)
    
    # 检查是否已确认（确认后不可修改，除非是超级管理员）
    if test_group.is_confirmed and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="试验组已确认，无法修改")
    
    # 记录原始数据
    original_data = {
        "name": test_group.name,
        "cycle": test_group.cycle,
        "dosage": test_group.dosage,
        "planned_count": test_group.planned_count,
        "backup_count": test_group.backup_count,
        "subject_prefix": test_group.subject_prefix,
        "subject_start_number": test_group.subject_start_number,
        "detection_configs": test_group.detection_configs,
        "collection_points": test_group.collection_points,
    }
    
    # 更新字段
    update_data = data.model_dump(exclude_unset=True, exclude={"audit_reason"})
    
    # 处理 collection_points
    if "collection_points" in update_data and update_data["collection_points"] is not None:
        update_data["collection_points"] = [cp.model_dump() if hasattr(cp, 'model_dump') else cp for cp in update_data["collection_points"]]
    
    # 处理 detection_configs
    if "detection_configs" in update_data and update_data["detection_configs"] is not None:
        update_data["detection_configs"] = [dc.model_dump() if hasattr(dc, 'model_dump') else dc for dc in update_data["detection_configs"]]
    
    for key, value in update_data.items():
        setattr(test_group, key, value)
    
    test_group.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(test_group)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="test_group",
        entity_id=test_group.id,
        action="update",
        details={"original": original_data, "updated": update_data},
        reason=data.audit_reason,
    )
    
    return test_group


@router.delete("/test-groups/{test_group_id}")
async def delete_test_group(
    test_group_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """删除试验组（软删除）"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限删除试验组")
    
    result = await db.execute(
        select(TestGroup).where(TestGroup.id == test_group_id)
    )
    test_group = result.scalar_one_or_none()
    
    if not test_group or not test_group.is_active:
        raise HTTPException(status_code=404, detail="试验组不存在")
    
    await assert_project_access(db, current_user, test_group.project_id)
    
    # 检查是否已确认（确认后不可删除，除非是超级管理员）
    if test_group.is_confirmed and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="试验组已确认，无法删除")
    
    # 软删除
    test_group.is_active = False
    test_group.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="test_group",
        entity_id=test_group.id,
        action="delete",
        details={"name": test_group.name, "project_id": test_group.project_id},
    )
    
    return {"message": "试验组已删除"}


@router.post("/test-groups/{test_group_id}/confirm", response_model=TestGroupResponse)
async def confirm_test_group(
    test_group_id: int,
    data: TestGroupConfirm,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """确认试验组（确认后锁定，不可修改）"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限确认试验组")
    
    # 验证密码
    if not pwd_context.verify(data.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="密码验证失败")
    
    result = await db.execute(
        select(TestGroup).where(TestGroup.id == test_group_id)
    )
    test_group = result.scalar_one_or_none()
    
    if not test_group or not test_group.is_active:
        raise HTTPException(status_code=404, detail="试验组不存在")
    
    await assert_project_access(db, current_user, test_group.project_id)
    
    if test_group.is_confirmed:
        raise HTTPException(status_code=400, detail="试验组已确认")
    
    # 确认试验组
    test_group.is_confirmed = True
    test_group.confirmed_at = datetime.utcnow()
    test_group.confirmed_by = current_user.id
    test_group.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(test_group)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="test_group",
        entity_id=test_group.id,
        action="confirm",
        details={
            "name": test_group.name,
            "project_id": test_group.project_id,
            "confirmed_at": test_group.confirmed_at.isoformat() if test_group.confirmed_at else None,
        },
        reason=data.reason,
    )
    
    return test_group


@router.post("/test-groups/copy", response_model=TestGroupResponse)
async def copy_test_group(
    data: TestGroupCopy,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """复制试验组"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限复制试验组")
    
    # 获取源试验组
    result = await db.execute(
        select(TestGroup).where(TestGroup.id == data.source_id)
    )
    source = result.scalar_one_or_none()
    
    if not source or not source.is_active:
        raise HTTPException(status_code=404, detail="源试验组不存在")
    
    await assert_project_access(db, current_user, source.project_id)
    
    # 获取当前项目最大的 display_order
    max_order_result = await db.execute(
        select(TestGroup.display_order)
        .where(TestGroup.project_id == source.project_id)
        .where(TestGroup.is_active == True)
        .order_by(TestGroup.display_order.desc())
        .limit(1)
    )
    max_order = max_order_result.scalar_one_or_none() or 0
    
    # 创建新的试验组
    new_test_group = TestGroup(
        project_id=source.project_id,
        name=data.new_name or f"{source.name or '试验组'} (副本)",
        cycle=source.cycle,
        dosage=source.dosage,
        planned_count=source.planned_count,
        backup_count=source.backup_count,
        subject_prefix=source.subject_prefix,
        subject_start_number=source.subject_start_number,
        detection_configs=source.detection_configs,
        collection_points=source.collection_points,
        display_order=max_order + 1,
        created_by=current_user.id,
        is_confirmed=False,  # 复制的试验组默认未确认
    )
    
    db.add(new_test_group)
    await db.commit()
    await db.refresh(new_test_group)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="test_group",
        entity_id=new_test_group.id,
        action="copy",
        details={
            "source_id": source.id,
            "source_name": source.name,
            "new_name": new_test_group.name,
        },
    )
    
    return new_test_group


# ==================== 采集点 CRUD ====================

@router.get("/projects/{project_id}/collection-points", response_model=List[CollectionPointResponse])
async def list_collection_points(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """获取项目的采集点列表"""
    await assert_project_access(db, current_user, project_id)
    
    result = await db.execute(
        select(CollectionPoint)
        .where(CollectionPoint.project_id == project_id)
        .where(CollectionPoint.is_active == True)
        .order_by(CollectionPoint.display_order, CollectionPoint.id)
    )
    return result.scalars().all()


@router.post("/collection-points", response_model=CollectionPointResponse)
async def create_collection_point(
    data: CollectionPointCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """创建采集点"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限创建采集点")
    
    if data.project_id:
        await assert_project_access(db, current_user, data.project_id)
    
    collection_point = CollectionPoint(**data.model_dump())
    db.add(collection_point)
    await db.commit()
    await db.refresh(collection_point)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="collection_point",
        entity_id=collection_point.id,
        action="create",
        details=data.model_dump(),
    )
    
    return collection_point


@router.put("/collection-points/{point_id}", response_model=CollectionPointResponse)
async def update_collection_point(
    point_id: int,
    data: CollectionPointUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """更新采集点"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限修改采集点")
    
    result = await db.execute(
        select(CollectionPoint).where(CollectionPoint.id == point_id)
    )
    collection_point = result.scalar_one_or_none()
    
    if not collection_point or not collection_point.is_active:
        raise HTTPException(status_code=404, detail="采集点不存在")
    
    if collection_point.project_id:
        await assert_project_access(db, current_user, collection_point.project_id)
    
    # 记录原始数据
    original_data = {
        "code": collection_point.code,
        "name": collection_point.name,
        "description": collection_point.description,
    }
    
    # 更新字段
    update_data = data.model_dump(exclude_unset=True, exclude={"audit_reason"})
    for key, value in update_data.items():
        setattr(collection_point, key, value)
    
    collection_point.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(collection_point)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="collection_point",
        entity_id=collection_point.id,
        action="update",
        details={"original": original_data, "updated": update_data},
        reason=data.audit_reason,
    )
    
    return collection_point


@router.delete("/collection-points/{point_id}")
async def delete_collection_point(
    point_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """删除采集点（软删除）"""
    if not check_test_group_permission(current_user):
        raise HTTPException(status_code=403, detail="没有权限删除采集点")
    
    result = await db.execute(
        select(CollectionPoint).where(CollectionPoint.id == point_id)
    )
    collection_point = result.scalar_one_or_none()
    
    if not collection_point or not collection_point.is_active:
        raise HTTPException(status_code=404, detail="采集点不存在")
    
    if collection_point.project_id:
        await assert_project_access(db, current_user, collection_point.project_id)
    
    # 软删除
    collection_point.is_active = False
    collection_point.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="collection_point",
        entity_id=collection_point.id,
        action="delete",
        details={"code": collection_point.code, "name": collection_point.name},
    )
    
    return {"message": "采集点已删除"}
