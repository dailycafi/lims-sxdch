from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from pydantic import BaseModel
import json
from io import BytesIO

from app.core.database import get_db
from app.models.sample import Sample, SampleStatus, SampleReceiveRecord, SampleBorrowRequest, SampleBorrowItem, SampleTransferRecord, SampleTransferItem, SampleDestroyRequest, SampleDestroyItem, SampleArchiveRequest, SampleArchiveItem
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.sample import SampleCreate, SampleUpdate, SampleResponse
from app.api.v1.endpoints.auth import get_current_user
from fastapi.responses import StreamingResponse
import pandas as pd

router = APIRouter()


# Pydantic schemas
class SampleReceiveCreate(BaseModel):
    project_id: int
    clinical_org_id: int
    transport_org_id: int
    transport_method: str
    temperature_monitor_id: str
    sample_count: int
    sample_status: str
    storage_location: Optional[str] = None


class ReceiveTaskResponse(BaseModel):
    id: int
    project_id: int
    project_name: str
    clinical_site: str
    transport_company: str
    transport_method: str
    temperature_monitor_id: str
    sample_count: int
    sample_status: str
    received_by: str
    received_at: str
    status: str


def check_sample_permission(user: User, action: str = "read") -> bool:
    """检查样本操作权限"""
    if action == "read":
        return True  # 所有人都可以查看
    
    if action in ["create", "receive", "inventory"]:
        return user.role in [UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]
    
    if action in ["request", "checkout", "return", "transfer", "destroy"]:
        allowed_roles = [
            UserRole.SYSTEM_ADMIN,
            UserRole.SAMPLE_ADMIN,
            UserRole.PROJECT_LEAD,
            UserRole.ANALYST
        ]
        return user.role in allowed_roles
    
    return False


@router.get("/storage/structure")
async def get_storage_structure(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取存储结构（冰箱->层->架->盒）"""
    # 1. 获取所有唯一的 freezer_id
    result = await db.execute(
        select(Sample.freezer_id).distinct().where(Sample.freezer_id.isnot(None))
    )
    freezers = [f for f in result.scalars().all() if f]
    freezers.sort()

    # 2. 构建层级结构
    # 为了性能，我们一次性获取所有样本的位置信息，然后在内存中构建树
    # 或者针对每个冰箱查询。如果样本量巨大，应该优化。
    # 这里为了简单，查询所有非空的存储位置组合
    result = await db.execute(
        select(Sample.freezer_id, Sample.shelf_level, Sample.rack_position, Sample.box_code)
        .distinct()
        .where(Sample.freezer_id.isnot(None))
    )
    locations = result.all()

    hierarchy = {}
    for f, s, r, b in locations:
        if not f or not s or not r:
            continue
        
        if f not in hierarchy:
            hierarchy[f] = {}
        if s not in hierarchy[f]:
            hierarchy[f][s] = {}
        if r not in hierarchy[f][s]:
            hierarchy[f][s][r] = []
        
        if b and b not in hierarchy[f][s][r]:
            hierarchy[f][s][r].append(b)
            hierarchy[f][s][r].sort()

    return {
        "freezers": freezers,
        "hierarchy": hierarchy
    }


@router.get("/storage/freezers")
async def get_freezers(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取所有冰箱及其使用情况统计"""
    # 获取所有唯一的冰箱ID
    result = await db.execute(
        select(Sample.freezer_id).distinct().where(Sample.freezer_id.isnot(None))
    )
    freezer_ids = [f for f in result.scalars().all() if f]
    
    freezers = []
    for fid in sorted(freezer_ids):
        # 统计该冰箱的样本盒数量
        box_result = await db.execute(
            select(Sample.box_code).distinct().where(
                Sample.freezer_id == fid,
                Sample.box_code.isnot(None)
            )
        )
        boxes = [b for b in box_result.scalars().all() if b]
        
        # 统计层数
        shelf_result = await db.execute(
            select(Sample.shelf_level).distinct().where(
                Sample.freezer_id == fid,
                Sample.shelf_level.isnot(None)
            )
        )
        shelves = [s for s in shelf_result.scalars().all() if s]
        
        # 估算总容量（每层10个盒子）
        total_boxes = len(shelves) * 10 if shelves else 10
        
        freezers.append({
            "id": fid,
            "name": fid,  # 可以从配置表获取更友好的名称
            "location": "样本库",  # 可以从配置表获取
            "temperature": -80,  # 默认超低温，可以从配置表获取
            "shelves": len(shelves) or 1,
            "total_boxes": max(total_boxes, len(boxes)),
            "used_boxes": len(boxes)
        })
    
    return freezers


@router.get("/storage/boxes")
async def get_boxes(
    freezer_id: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取样本盒列表"""
    # 构建查询
    query = select(
        Sample.box_code,
        Sample.freezer_id,
        Sample.shelf_level,
        Sample.rack_position,
        func.count(Sample.id).label('used_slots')
    ).where(
        Sample.box_code.isnot(None)
    ).group_by(
        Sample.box_code,
        Sample.freezer_id,
        Sample.shelf_level,
        Sample.rack_position
    )
    
    if freezer_id:
        query = query.where(Sample.freezer_id == freezer_id)
    
    result = await db.execute(query)
    rows = result.all()
    
    boxes = []
    for row in rows:
        boxes.append({
            "id": hash(f"{row.freezer_id}-{row.shelf_level}-{row.rack_position}-{row.box_code}") % 1000000,
            "code": row.box_code,
            "freezer_id": row.freezer_id,
            "shelf_level": row.shelf_level,
            "rack_position": row.rack_position,
            "rows": 10,  # 默认10x10
            "cols": 10,
            "total_slots": 100,
            "used_slots": row.used_slots,
            "created_at": datetime.utcnow().isoformat()
        })
    
    return boxes


@router.post("/storage/boxes")
async def create_box(
    box_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建新的样本盒（记录到审计日志）"""
    if not check_sample_permission(current_user, "create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限创建样本盒"
        )
    
    # 记录审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_box",
        entity_id=0,
        action="create",
        details={
            "box_code": box_data.get("code"),
            "freezer_id": box_data.get("freezer_id"),
            "shelf_level": box_data.get("shelf_level"),
            "rack_position": box_data.get("rack_position"),
            "rows": box_data.get("rows", 10),
            "cols": box_data.get("cols", 10)
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {
        "message": "样本盒创建成功",
        "box": box_data
    }


@router.put("/storage/boxes/{box_id}")
async def update_box(
    box_id: int,
    box_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新样本盒信息"""
    if not check_sample_permission(current_user, "create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改样本盒"
        )
    
    # 由于样本盒信息存储在样本表中，我们需要更新所有属于该盒子的样本
    # 首先找到原始盒子信息
    old_box_code = box_data.get("old_code")
    new_code = box_data.get("code")
    new_shelf_level = box_data.get("shelf_level")
    new_rack_position = box_data.get("rack_position")
    
    if new_code and old_box_code and new_code != old_box_code:
        # 更新所有样本的 box_code
        await db.execute(
            Sample.__table__.update()
            .where(Sample.box_code == old_box_code)
            .values(box_code=new_code)
        )
    
    # 记录审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_box",
        entity_id=box_id,
        action="update",
        details={
            "box_code": new_code,
            "shelf_level": new_shelf_level,
            "rack_position": new_rack_position,
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {
        "message": "样本盒更新成功",
        "box": box_data
    }


@router.delete("/storage/boxes/{box_id}")
async def delete_box(
    box_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除样本盒（仅当盒子为空时）"""
    if not check_sample_permission(current_user, "create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除样本盒"
        )
    
    # 注意：由于样本盒信息存储在样本表中，删除操作主要是清除样本的盒子关联
    # 实际实现中可能需要一个独立的 SampleBox 表
    # 这里我们记录审计日志
    
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_box",
        entity_id=box_id,
        action="delete",
        details={
            "box_id": box_id
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {
        "message": "样本盒删除成功"
    }


@router.get("/storage/box/{freezer_id}/{shelf_level}/{rack_position}/{box_code}")
async def get_box_content(
    freezer_id: str,
    shelf_level: str,
    rack_position: str,
    box_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取指定盒子内的样本"""
    query = select(Sample).where(
        Sample.freezer_id == freezer_id,
        Sample.shelf_level == shelf_level,
        Sample.rack_position == rack_position,
        Sample.box_code == box_code
    )
    result = await db.execute(query)
    samples = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "sample_code": s.sample_code,
            "position_in_box": s.position_in_box,
            "status": s.status,
            "test_type": s.test_type
        }
        for s in samples
    ]


@router.post("/batch", response_model=List[SampleResponse])
async def create_samples_batch(
    samples_data: List[SampleCreate],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """批量创建样本"""
    if not check_sample_permission(current_user, "create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限创建样本"
        )
    
    created_samples = []
    
    try:
        for sample_data in samples_data:
            # 检查样本编号是否已存在
            result = await db.execute(
                select(Sample).where(Sample.sample_code == sample_data.sample_code)
            )
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"样本编号已存在: {sample_data.sample_code}"
                )
            
            db_sample = Sample(**sample_data.model_dump())
            db.add(db_sample)
            created_samples.append(db_sample)
        
        await db.commit()
        
        # 刷新所有创建的样本
        for sample in created_samples:
            await db.refresh(sample)
        
        return created_samples
        
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建样本失败"
        )


@router.get("/receive-tasks", response_model=List[dict])
async def get_receive_tasks(
    status: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取接收任务列表"""
    from sqlalchemy.orm import selectinload
    from app.models.project import Project
    from app.models.global_params import Organization
    
    query = select(SampleReceiveRecord).options(
        selectinload(SampleReceiveRecord.project),
        selectinload(SampleReceiveRecord.clinical_org),
        selectinload(SampleReceiveRecord.transport_org),
        selectinload(SampleReceiveRecord.receiver)
    )
    
    if status:
        query = query.where(SampleReceiveRecord.status == status)
    
    query = query.order_by(SampleReceiveRecord.received_at.desc())
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    # 转换为响应格式
    tasks = []
    for record in records:
        tasks.append({
            "id": record.id,
            "project_id": record.project_id,
            "project_name": record.project.lab_project_code if record.project else "",
            "clinical_site": record.clinical_org.name if record.clinical_org else "",
            "transport_company": record.transport_org.name if record.transport_org else "",
            "transport_method": record.transport_method,
            "temperature_monitor_id": record.temperature_monitor_id,
            "sample_count": record.sample_count,
            "sample_status": record.sample_status,
            "received_by": record.receiver.full_name if record.receiver else "",
            "received_at": record.received_at.isoformat(),
            "status": record.status
        })
    
    return tasks


@router.get("/receive-records", response_model=List[dict])
async def list_receive_records(
    status: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """接收记录列表（与 /receive-tasks 等价，作为别名便于前端接入）"""
    return await get_receive_tasks(status=status, current_user=current_user, db=db)  # type: ignore


@router.get("/", response_model=List[SampleResponse])
async def read_samples(
    project_id: int = None,
    status: SampleStatus = None,
    skip: int = 0,
    limit: int = 100,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取样本列表"""
    query = select(Sample)
    
    if project_id:
        query = query.where(Sample.project_id == project_id)
    if status:
        query = query.where(Sample.status == status)
    
    result = await db.execute(query.offset(skip).limit(limit))
    samples = result.scalars().all()
    return samples


@router.get("/by-code/{sample_code}", response_model=SampleResponse)
async def read_sample_by_code(
    sample_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """根据样本编号获取样本信息"""
    result = await db.execute(select(Sample).where(Sample.sample_code == sample_code))
    sample = result.scalar_one_or_none()
    
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="样本不存在"
        )
    
    return sample


@router.patch("/{sample_id}", response_model=SampleResponse)
async def update_sample(
    sample_id: int,
    sample_update: SampleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新样本信息"""
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="样本不存在"
        )
    
    # 根据更新的内容检查权限
    update_data = sample_update.model_dump(exclude_unset=True)
    if "status" in update_data:
        if not check_sample_permission(current_user, "inventory"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限更新样本状态"
            )
    
    for field, value in update_data.items():
        setattr(sample, field, value)
    
    await db.commit()
    await db.refresh(sample)
    return sample


@router.post("/receive")
async def receive_samples(
    project_id: int = Form(...),
    clinical_org_id: int = Form(...),
    transport_org_id: int = Form(...),
    transport_method: str = Form(...),
    temperature_monitor_id: str = Form(...),
    sample_count: int = Form(...),
    sample_status: str = Form(...),
    storage_location: Optional[str] = Form(None),
    temperature_file: Optional[UploadFile] = File(None),
    express_photos: List[UploadFile] = File(None),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """接收样本，创建接收记录"""
    if not check_sample_permission(current_user, "receive"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以接收样本"
        )
    
    import os
    
    # 保存温度文件
    temperature_file_path = None
    if temperature_file:
        # 创建上传目录
        upload_dir = "uploads/temperature"
        os.makedirs(upload_dir, exist_ok=True)
        
        # 生成唯一文件名
        file_extension = os.path.splitext(temperature_file.filename)[1]
        file_name = f"{temperature_monitor_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{file_extension}"
        file_path = os.path.join(upload_dir, file_name)
        
        # 保存文件
        with open(file_path, "wb") as f:
            content = await temperature_file.read()
            f.write(content)
        
        temperature_file_path = file_path
    
    # 保存快递单照片
    express_photo_paths = []
    if express_photos:
        upload_dir = "uploads/express_photos"
        os.makedirs(upload_dir, exist_ok=True)
        
        for photo in express_photos:
            file_extension = os.path.splitext(photo.filename)[1]
            file_name = f"{temperature_monitor_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(express_photo_paths)}{file_extension}"
            file_path = os.path.join(upload_dir, file_name)
            
            with open(file_path, "wb") as f:
                content = await photo.read()
                f.write(content)
            express_photo_paths.append(file_path)
    
    # 创建接收记录
    receive_record = SampleReceiveRecord(
        project_id=project_id,
        clinical_org_id=clinical_org_id,
        transport_org_id=transport_org_id,
        transport_method=transport_method,
        temperature_monitor_id=temperature_monitor_id,
        temperature_file_path=temperature_file_path,
        sample_count=sample_count,
        sample_status=sample_status,
        storage_location=storage_location,
        express_photos=json.dumps(express_photo_paths) if express_photo_paths else None,
        received_by=current_user.id,
        received_at=datetime.utcnow(),
        status="pending"  # 待清点
    )
    
    db.add(receive_record)
    await db.commit()
    await db.refresh(receive_record)
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_receive",
        entity_id=receive_record.id,
        action="create",
        details={
            "project_id": project_id,
            "sample_count": sample_count,
            "transport_method": transport_method
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": f"成功接收 {sample_count} 个样本", "receive_id": receive_record.id}





@router.get("/receive-records/{record_id}")
async def get_receive_record(
    record_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取接收记录详情"""
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(SampleReceiveRecord)
        .options(
            selectinload(SampleReceiveRecord.project),
            selectinload(SampleReceiveRecord.clinical_org),
            selectinload(SampleReceiveRecord.transport_org),
            selectinload(SampleReceiveRecord.receiver)
        )
        .where(SampleReceiveRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="接收记录不存在"
        )
    
    return record


@router.get("/receive-records/{record_id}/expected-samples")
async def get_expected_samples(
    record_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取应该清点的样本编号列表"""
    # TODO: 根据接收记录和项目配置，生成应该清点的样本编号列表
    # 这里返回模拟数据
    sample_codes = []
    for i in range(1, 11):  # 模拟10个样本
        sample_codes.append(f"L2501-CHH-001-PK-{i:02d}-2h-A-a1")
    
    return sample_codes


@router.post("/receive-records/{record_id}/complete-inventory")
async def complete_inventory(
    record_id: int,
    inventory_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """完成清点"""
    if not check_sample_permission(current_user, "inventory"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以清点样本"
        )
    
    # 获取接收记录
    result = await db.execute(
        select(SampleReceiveRecord).where(SampleReceiveRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="接收记录不存在"
        )
    
    # 更新状态
    record.status = "completed"
    
    # 保存清点的样本信息
    samples = inventory_data.get("samples", [])
    boxes = inventory_data.get("boxes", [])
    
    # 辅助字典：记录每个盒子已使用的位置计数
    box_counters = {}  # box_code -> current_count

    # 创建样本记录，关联样本盒
    for sample_data in samples:
        if sample_data["status"] == "scanned":
            box_code = sample_data.get("boxCode")
            
            # 计算盒内位置
            if box_code:
                if box_code not in box_counters:
                    box_counters[box_code] = 0
                box_counters[box_code] += 1
                position = str(box_counters[box_code])
            else:
                position = None

            sample = Sample(
                sample_code=sample_data["code"],
                project_id=record.project_id,
                status=SampleStatus.IN_STORAGE,
                box_code=box_code,
                position_in_box=position,
                special_notes=sample_data.get("specialNotes"),
                created_at=datetime.utcnow()
            )
            db.add(sample)
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_inventory",
        entity_id=record_id,
        action="complete",
        details={
            "total_samples": len(samples),
            "scanned_samples": len([s for s in samples if s["status"] == "scanned"]),
            "error_samples": len([s for s in samples if s["status"] == "error"]),
            "boxes_used": len(boxes)
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "清点完成"}


@router.get("/receive-records/{record_id}/export")
async def export_receive_record_checklist(
    record_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导出临床样本清单表（Excel）"""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(SampleReceiveRecord).options(
            selectinload(SampleReceiveRecord.project),
            selectinload(SampleReceiveRecord.clinical_org),
            selectinload(SampleReceiveRecord.transport_org),
            selectinload(SampleReceiveRecord.receiver)
        ).where(SampleReceiveRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="接收记录不存在")

    # 明细：如果已创建样本，导出样本编号；否则导出预计样本编号
    result = await db.execute(select(Sample).where(Sample.project_id == record.project_id))
    samples = result.scalars().all()
    detail_rows = []
    if samples:
        for s in samples:
            detail_rows.append({
                "样本编号": s.sample_code,
                "特殊事项": getattr(s, "special_notes", "")
            })
    else:
        expected = await get_expected_samples(record_id, current_user, db)  # type: ignore
        for code in expected:
            detail_rows.append({
                "样本编号": code,
                "特殊事项": ""
            })

    # 头部信息
    header_rows = [
        {"字段": "申办方", "值": record.project.sponsor.name if getattr(record.project, "sponsor", None) else ""},
        {"字段": "申办方项目编号", "值": record.project.sponsor_project_code if record.project else ""},
        {"字段": "临床机构/分中心", "值": record.clinical_org.name if record.clinical_org else ""},
        {"字段": "检测单位/部门", "值": record.project.testing_org.name if getattr(record.project, "testing_org", None) else ""},
        {"字段": "临床试验研究室项目编号", "值": record.project.lab_project_code if record.project else ""},
        {"字段": "运输单位/运输方式", "值": f"{record.transport_org.name if record.transport_org else ''}/{record.transport_method}"},
        {"字段": "样本数量", "值": record.sample_count},
        {"字段": "样本状态", "值": record.sample_status},
        {"字段": "接收人/接收时间", "值": f"{record.receiver.full_name if record.receiver else ''} / {record.received_at.isoformat()}"},
    ]

    # 生成Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        pd.DataFrame(header_rows).to_excel(writer, index=False, sheet_name="Header")
        pd.DataFrame(detail_rows).to_excel(writer, index=False, sheet_name="Details")
        writer.close()

    output.seek(0)
    filename = f"receive_checklist_{record_id}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post("/storage/assign")
async def assign_storage(
    storage_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """分配存储位置"""
    if not check_sample_permission(current_user, "inventory"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以分配存储位置"
        )
    
    assignments = storage_data.get("assignments", [])
    
    # 更新样本的存储位置
    for assignment in assignments:
        result = await db.execute(
            select(Sample).where(Sample.box_code == assignment["box_code"])
        )
        samples = result.scalars().all()
        
        for sample in samples:
            sample.freezer_id = assignment["freezer_id"]
            sample.shelf_level = assignment["shelf_level"]
            sample.rack_position = assignment["rack_position"]
            sample.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="storage_assignment",
        entity_id=storage_data.get("receive_record_id"),
        action="assign",
        details={
            "assignments": assignments
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "存储位置分配完成"}


# 样本领用归还相关API
@router.post("/borrow-request")
async def create_borrow_request(
    request_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建样本领用申请"""
    if not check_sample_permission(current_user, "request"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限申请领用样本"
        )
    
    # 生成申请编号
    count = await db.execute(
        select(func.count()).select_from(SampleBorrowRequest)
    )
    count_value = count.scalar() or 0
    request_code = f"BR-{datetime.now().strftime('%Y%m%d')}-{count_value + 1:04d}"
    
    # 创建申请记录
    borrow_request = SampleBorrowRequest(
        request_code=request_code,
        project_id=request_data["project_id"],
        requested_by=current_user.id,
        purpose=request_data["purpose"],
        target_location=request_data["target_location"],
        target_date=datetime.fromisoformat(request_data["target_date"]),
        notes=request_data.get("notes"),
        status="pending"
    )
    
    db.add(borrow_request)
    await db.commit()
    await db.refresh(borrow_request)
    
    # 创建领用明细
    for sample_code in request_data["sample_codes"]:
        result = await db.execute(
            select(Sample).where(Sample.sample_code == sample_code)
        )
        sample = result.scalar_one_or_none()
        
        if sample:
            borrow_item = SampleBorrowItem(
                request_id=borrow_request.id,
                sample_id=sample.id
            )
            db.add(borrow_item)
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="borrow_request",
        entity_id=borrow_request.id,
        action="create",
        details={
            "request_code": request_code,
            "sample_count": len(request_data["sample_codes"]),
            "purpose": request_data["purpose"]
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "领用申请创建成功", "request_code": request_code}


@router.get("/borrow-requests")
async def get_borrow_requests(
    status: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取领用申请列表"""
    from sqlalchemy.orm import selectinload
    
    query = select(SampleBorrowRequest).options(
        selectinload(SampleBorrowRequest.project),
        selectinload(SampleBorrowRequest.requester),
        selectinload(SampleBorrowRequest.samples)
    )
    
    if status == "pending":
        query = query.where(SampleBorrowRequest.status.in_(["pending", "approved"]))
    elif status == "borrowed":
        query = query.where(SampleBorrowRequest.status.in_(["borrowed", "partial_returned"]))
    elif status == "history":
        query = query.where(SampleBorrowRequest.status == "returned")
    
    query = query.order_by(SampleBorrowRequest.created_at.desc())
    
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # 转换为响应格式
    response = []
    for req in requests:
        response.append({
            "id": req.id,
            "request_code": req.request_code,
            "project": {
                "lab_project_code": req.project.lab_project_code if req.project else "",
                "sponsor_project_code": req.project.sponsor_project_code if req.project else ""
            },
            "requested_by": {
                "full_name": req.requester.full_name if req.requester else ""
            },
            "sample_count": len(req.samples),
            "purpose": req.purpose,
            "target_location": req.target_location,
            "target_date": req.target_date.isoformat() if req.target_date else "",
            "status": req.status,
            "created_at": req.created_at.isoformat()
        })
    
    return response


@router.get("/borrow-request/{request_id}")
async def get_borrow_request(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取领用申请详情"""
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(SampleBorrowRequest)
        .options(
            selectinload(SampleBorrowRequest.project),
            selectinload(SampleBorrowRequest.requester),
            selectinload(SampleBorrowItem.sample)
        )
        .where(SampleBorrowRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="领用申请不存在"
        )
    
    # 构造响应
    samples = []
    for item in request.samples:
        samples.append({
            "id": item.id,
            "sample_code": item.sample.sample_code,
            "test_type": item.sample.test_type,
            "subject_code": item.sample.subject_code,
            "collection_time": item.sample.collection_time,
            "location": f"{item.sample.freezer_id}-{item.sample.shelf_level}-{item.sample.rack_position}"
        })
    
    return {
        "id": request.id,
        "request_code": request.request_code,
        "project": {
            "lab_project_code": request.project.lab_project_code,
            "sponsor_project_code": request.project.sponsor_project_code
        },
        "requested_by": {
            "full_name": request.requester.full_name
        },
        "purpose": request.purpose,
        "target_location": request.target_location,
        "sample_count": len(request.samples),
        "samples": samples
    }


@router.post("/borrow-request/{request_id}/approve")
async def approve_borrow_request(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """批准领用申请"""
    # TODO: 检查审批权限
    
    result = await db.execute(
        select(SampleBorrowRequest).where(SampleBorrowRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="领用申请不存在"
        )
    
    request.status = "approved"
    request.approved_by = current_user.id
    request.approved_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "领用申请已批准"}


@router.post("/borrow-request/{request_id}/execute")
async def execute_borrow(
    request_id: int,
    execution_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """执行领用"""
    if not check_sample_permission(current_user, "checkout"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限执行领用"
        )
    
    # 更新申请状态
    result = await db.execute(
        select(SampleBorrowRequest).where(SampleBorrowRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="领用申请不存在"
        )
    
    request.status = "borrowed"
    
    # 更新样本状态
    for sample_data in execution_data["samples"]:
        if sample_data["status"] == "scanned":
            result = await db.execute(
                select(Sample).where(Sample.sample_code == sample_data["code"])
            )
            sample = result.scalar_one_or_none()
            
            if sample:
                sample.status = SampleStatus.CHECKED_OUT
                
                # 更新领用明细
                result = await db.execute(
                    select(SampleBorrowItem).where(
                        SampleBorrowItem.request_id == request_id,
                        SampleBorrowItem.sample_id == sample.id
                    )
                )
                item = result.scalar_one_or_none()
                if item:
                    item.borrowed_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "领用执行完成"}


@router.post("/return")
async def return_samples(
    return_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """归还样本"""
    if not check_sample_permission(current_user, "return"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限归还样本"
        )
    
    borrow_record_id = return_data["borrow_record_id"]
    
    # 获取领用记录
    result = await db.execute(
        select(SampleBorrowRequest).where(SampleBorrowRequest.id == borrow_record_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="领用记录不存在"
        )
    
    # 更新样本状态和存储位置
    returned_count = 0
    for sample_data in return_data["samples"]:
        result = await db.execute(
            select(Sample).where(Sample.sample_code == sample_data["sample_code"])
        )
        sample = result.scalar_one_or_none()
        
        if sample:
            sample.status = SampleStatus.IN_STORAGE
            sample.box_code = sample_data.get("box_code")
            
            # 更新领用明细
            result = await db.execute(
                select(SampleBorrowItem).where(
                    SampleBorrowItem.request_id == borrow_record_id,
                    SampleBorrowItem.sample_id == sample.id
                )
            )
            item = result.scalar_one_or_none()
            if item:
                item.returned_at = datetime.utcnow()
                item.return_status = sample_data.get("return_status", "good")
                returned_count += 1
    
    # 检查是否全部归还
    result = await db.execute(
        select(func.count()).select_from(SampleBorrowItem).where(
            SampleBorrowItem.request_id == borrow_record_id,
            SampleBorrowItem.returned_at.is_(None)
        )
    )
    unreturned_count = result.scalar() or 0
    
    if unreturned_count == 0:
        request.status = "returned"
    else:
        request.status = "partial_returned"
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_return",
        entity_id=borrow_record_id,
        action="return",
        details={
            "returned_count": returned_count,
            "boxes": return_data.get("boxes", [])
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": f"成功归还 {returned_count} 个样本"}


# 样本转移相关API
@router.post("/transfer/external")
async def create_external_transfer(
    project_id: int = Form(...),
    sample_codes: str = Form(...),  # JSON字符串
    target_org_id: int = Form(...),
    transport_method: str = Form(...),
    target_date: str = Form(...),
    notes: Optional[str] = Form(None),
    approval_file: Optional[UploadFile] = File(None),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """创建外部转移申请"""
    if not check_sample_permission(current_user, "transfer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限申请转移样本"
        )
    
    # 解析样本编号
    try:
        sample_code_list = json.loads(sample_codes)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="样本编号格式错误"
        )
    
    # 保存审批文件
    approval_file_path = None
    if approval_file:
        import os
        os.makedirs("uploads/approvals", exist_ok=True)
        file_extension = os.path.splitext(approval_file.filename or "")[1]
        safe_ext = file_extension if len(file_extension) <= 10 else ""
        file_name = f"transfer_{datetime.now().strftime('%Y%m%d_%H%M%S')}{safe_ext}"
        file_path = os.path.join("uploads/approvals", file_name)
        content = await approval_file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        approval_file_path = file_path
    
    # 生成转移编号
    count = await db.execute(
        select(func.count()).select_from(SampleTransferRecord)
    )
    count_value = count.scalar() or 0
    transfer_code = f"TR-{datetime.now().strftime('%Y%m%d')}-{count_value + 1:04d}"
    
    # 获取出发地信息（假设从第一个样本获取）
    result = await db.execute(
        select(Sample).where(Sample.sample_code == sample_code_list[0])
    )
    first_sample = result.scalar_one_or_none()
    from_location = f"{first_sample.freezer_id}-{first_sample.shelf_level}-{first_sample.rack_position}" if first_sample else "实验室"
    
    # 获取目标组织信息
    from app.models.global_params import Organization
    result = await db.execute(
        select(Organization).where(Organization.id == target_org_id)
    )
    target_org = result.scalar_one_or_none()
    to_location = target_org.name if target_org else "未知"
    
    # 创建转移记录
    transfer_record = SampleTransferRecord(
        transfer_code=transfer_code,
        transfer_type="external",
        project_id=project_id,
        from_location=from_location,
        to_location=to_location,
        target_org_id=target_org_id,
        transport_method=transport_method,
        approval_file_path=approval_file_path,
        notes=notes,
        status="pending",
        requested_by=current_user.id
    )
    
    db.add(transfer_record)
    await db.commit()
    await db.refresh(transfer_record)
    
    # 创建转移明细
    for sample_code in sample_code_list:
        result = await db.execute(
            select(Sample).where(Sample.sample_code == sample_code)
        )
        sample = result.scalar_one_or_none()
        
        if sample:
            transfer_item = SampleTransferItem(
                transfer_id=transfer_record.id,
                sample_id=sample.id
            )
            db.add(transfer_item)
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_transfer",
        entity_id=transfer_record.id,
        action="create_external",
        details={
            "transfer_code": transfer_code,
            "sample_count": len(sample_code_list),
            "target_org": to_location,
            "transport_method": transport_method
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "外部转移申请创建成功", "transfer_code": transfer_code}


@router.post("/transfer/internal")
async def create_internal_transfer(
    transfer_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建内部转移"""
    if not check_sample_permission(current_user, "transfer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限转移样本"
        )
    
    # 生成转移编号
    count = await db.execute(
        select(func.count()).select_from(SampleTransferRecord)
    )
    count_value = count.scalar() or 0
    transfer_code = f"ITR-{datetime.now().strftime('%Y%m%d')}-{count_value + 1:04d}"
    
    # 创建转移记录
    transfer_record = SampleTransferRecord(
        transfer_code=transfer_code,
        transfer_type="internal",
        project_id=1,  # TODO: 内部转移可能涉及多个项目
        from_location=transfer_data["from_location"],
        to_location=transfer_data["to_location"],
        transport_method=transfer_data["transport_method"],
        temperature_monitor_id=transfer_data.get("temperature_monitor_id"),
        sample_status=transfer_data.get("sample_status"),
        status="completed",  # 内部转移直接完成
        requested_by=current_user.id,
        completed_at=datetime.utcnow()
    )
    
    db.add(transfer_record)
    await db.commit()
    await db.refresh(transfer_record)
    
    # 更新样本位置
    for sample_code in transfer_data["samples"]:
        result = await db.execute(
            select(Sample).where(Sample.sample_code == sample_code)
        )
        sample = result.scalar_one_or_none()
        
        if sample:
            # 解析新位置
            location_parts = transfer_data["to_location"].split("-")
            if len(location_parts) >= 3:
                sample.freezer_id = location_parts[0]
                sample.shelf_level = location_parts[1]
                sample.rack_position = "-".join(location_parts[2:])
            
            # 创建转移明细
            transfer_item = SampleTransferItem(
                transfer_id=transfer_record.id,
                sample_id=sample.id,
                transferred_at=datetime.utcnow(),
                received_at=datetime.utcnow()
            )
            db.add(transfer_item)
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_transfer",
        entity_id=transfer_record.id,
        action="create_internal",
        details={
            "transfer_code": transfer_code,
            "sample_count": len(transfer_data["samples"]),
            "from": transfer_data["from_location"],
            "to": transfer_data["to_location"]
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "内部转移完成", "transfer_code": transfer_code}


@router.get("/transfers")
async def get_transfers(
    type: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取转移记录列表"""
    from sqlalchemy.orm import selectinload
    
    query = select(SampleTransferRecord).options(
        selectinload(SampleTransferRecord.project),
        selectinload(SampleTransferRecord.requester),
        selectinload(SampleTransferRecord.samples)
    )
    
    if type:
        query = query.where(SampleTransferRecord.transfer_type == type)
    
    query = query.order_by(SampleTransferRecord.created_at.desc())
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    # 转换为响应格式
    response = []
    for record in records:
        response.append({
            "id": record.id,
            "transfer_code": record.transfer_code,
            "transfer_type": record.transfer_type,
            "project": {
                "lab_project_code": record.project.lab_project_code if record.project else "",
                "sponsor_project_code": record.project.sponsor_project_code if record.project else ""
            },
            "requested_by": {
                "full_name": record.requester.full_name if record.requester else ""
            },
            "sample_count": len(record.samples),
            "from_location": record.from_location,
            "to_location": record.to_location,
            "status": record.status,
            "created_at": record.created_at.isoformat()
        })
    
    return response


@router.post("/transfer/{transfer_id}/execute")
async def execute_transfer(
    transfer_id: int,
    execution_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """执行外部转移"""
    if not check_sample_permission(current_user, "transfer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限执行转移"
        )
    
    # 获取转移记录
    result = await db.execute(
        select(SampleTransferRecord).where(SampleTransferRecord.id == transfer_id)
    )
    transfer = result.scalar_one_or_none()
    
    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="转移记录不存在"
        )
    
    # 更新状态
    transfer.status = "in_transit"
    transfer.temperature_monitor_id = execution_data.get("temperature_monitor_id")
    transfer.sample_status = execution_data.get("sample_status")
    
    # 更新样本状态
    result = await db.execute(
        select(SampleTransferItem).where(SampleTransferItem.transfer_id == transfer_id)
    )
    items = result.scalars().all()
    
    for item in items:
        item.transferred_at = datetime.utcnow()
        # 更新样本状态
        result = await db.execute(
            select(Sample).where(Sample.id == item.sample_id)
        )
        sample = result.scalar_one_or_none()
        if sample:
            sample.status = SampleStatus.TRANSFERRED
    
    await db.commit()
    
    return {"message": "转移执行成功"}


# 样本销毁相关API
@router.post("/destroy-request")
async def create_destroy_request(
    project_id: int = Form(...),
    sample_codes: str = Form(...),  # JSON字符串
    reason: str = Form(...),
    notes: Optional[str] = Form(None),
    approval_file: Optional[UploadFile] = File(None),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """创建样本销毁申请"""
    if not check_sample_permission(current_user, "destroy"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限申请销毁样本"
        )
    
    # 解析样本编号
    try:
        sample_code_list = json.loads(sample_codes)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="样本编号格式错误"
        )
    
    # 保存审批文件
    approval_file_path = None
    if approval_file:
        import os
        os.makedirs("uploads/approvals", exist_ok=True)
        file_extension = os.path.splitext(approval_file.filename or "")[1]
        safe_ext = file_extension if len(file_extension) <= 10 else ""
        file_name = f"destroy_{datetime.now().strftime('%Y%m%d_%H%M%S')}{safe_ext}"
        file_path = os.path.join("uploads/approvals", file_name)
        content = await approval_file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        approval_file_path = file_path
    
    # 生成申请编号
    count = await db.execute(
        select(func.count()).select_from(SampleDestroyRequest)
    )
    count_value = count.scalar() or 0
    request_code = f"DR-{datetime.now().strftime('%Y%m%d')}-{count_value + 1:04d}"
    
    # 创建销毁申请
    destroy_request = SampleDestroyRequest(
        request_code=request_code,
        project_id=project_id,
        requested_by=current_user.id,
        reason=reason,
        approval_file_path=approval_file_path,
        notes=notes,
        status="pending"
    )
    
    db.add(destroy_request)
    await db.commit()
    await db.refresh(destroy_request)
    
    # 创建销毁明细
    for sample_code in sample_code_list:
        result = await db.execute(
            select(Sample).where(Sample.sample_code == sample_code)
        )
        sample = result.scalar_one_or_none()
        
        if sample:
            destroy_item = SampleDestroyItem(
                request_id=destroy_request.id,
                sample_id=sample.id
            )
            db.add(destroy_item)
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="destroy_request",
        entity_id=destroy_request.id,
        action="create",
        details={
            "request_code": request_code,
            "sample_count": len(sample_code_list),
            "reason": reason
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "销毁申请创建成功", "request_code": request_code}


@router.get("/destroy-requests")
async def get_destroy_requests(
    status: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取销毁申请列表"""
    from sqlalchemy.orm import selectinload
    
    query = select(SampleDestroyRequest).options(
        selectinload(SampleDestroyRequest.project),
        selectinload(SampleDestroyRequest.requester),
        selectinload(SampleDestroyRequest.samples)
    )
    
    if status == "pending":
        query = query.where(SampleDestroyRequest.status.in_(["pending", "test_manager_approved"]))
    elif status == "approved":
        query = query.where(SampleDestroyRequest.status.in_(["director_approved", "ready"]))
    elif status == "completed":
        query = query.where(SampleDestroyRequest.status == "completed")
    
    query = query.order_by(SampleDestroyRequest.created_at.desc())
    
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # 转换为响应格式
    response = []
    for req in requests:
        # 确定当前审批人
        current_approver = None
        if req.status == "pending":
            current_approver = "分析测试主管"
        elif req.status == "test_manager_approved":
            current_approver = "研究室主任"
        
        response.append({
            "id": req.id,
            "request_code": req.request_code,
            "project": {
                "lab_project_code": req.project.lab_project_code if req.project else "",
                "sponsor_project_code": req.project.sponsor_project_code if req.project else ""
            },
            "requested_by": {
                "full_name": req.requester.full_name if req.requester else ""
            },
            "sample_count": len(req.samples),
            "reason": req.reason,
            "current_approver": current_approver,
            "status": req.status,
            "created_at": req.created_at.isoformat()
        })
    
    return response


@router.get("/destroy-request/{request_id}/approvals")
async def get_destroy_approvals(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取销毁申请的审批流程"""
    result = await db.execute(
        select(SampleDestroyRequest).where(SampleDestroyRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="销毁申请不存在"
        )
    
    approvals = []
    
    # 分析测试主管审批
    test_manager_status = "pending"
    if request.test_manager_id:
        test_manager_status = "approved" if request.status != "rejected" else "rejected"
    
    approvals.append({
        "id": 1,
        "approver": {
            "full_name": request.test_manager.full_name if request.test_manager else "待审批",
            "role": "test_manager"
        },
        "status": test_manager_status,
        "comments": request.test_manager_comments,
        "approved_at": request.test_manager_approved_at.isoformat() if request.test_manager_approved_at else None
    })
    
    # 研究室主任审批
    if request.status in ["test_manager_approved", "director_approved", "ready", "completed"]:
        director_status = "pending"
        if request.director_id:
            director_status = "approved" if request.status != "rejected" else "rejected"
        
        approvals.append({
            "id": 2,
            "approver": {
                "full_name": request.director.full_name if request.director else "待审批",
                "role": "lab_director"
            },
            "status": director_status,
            "comments": request.director_comments,
            "approved_at": request.director_approved_at.isoformat() if request.director_approved_at else None
        })
    
    return approvals


@router.post("/destroy-request/{request_id}/approve")
async def approve_destroy_request(
    request_id: int,
    approval_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """审批销毁申请"""
    result = await db.execute(
        select(SampleDestroyRequest).where(SampleDestroyRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="销毁申请不存在"
        )
    
    action = approval_data.get("action", "approve")
    comments = approval_data.get("comments", "")
    
    # 根据当前状态和用户角色进行审批
    if request.status == "pending" and current_user.role == UserRole.TEST_MANAGER:
        # 分析测试主管审批
        request.test_manager_id = current_user.id
        request.test_manager_approved_at = datetime.utcnow()
        request.test_manager_comments = comments
        
        if action == "approve":
            request.status = "test_manager_approved"
        else:
            request.status = "rejected"
    
    elif request.status == "test_manager_approved" and current_user.role == UserRole.LAB_DIRECTOR:
        # 研究室主任审批
        request.director_id = current_user.id
        request.director_approved_at = datetime.utcnow()
        request.director_comments = comments
        
        if action == "approve":
            request.status = "ready"  # 准备执行
        else:
            request.status = "rejected"
    
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权进行此审批操作"
        )
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="destroy_approval",
        entity_id=request_id,
        action=action,
        details={
            "role": current_user.role.value,
            "comments": comments
        },
        reason=comments,
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": f"审批{'通过' if action == 'approve' else '拒绝'}"}


@router.post("/destroy-request/{request_id}/execute")
async def execute_destroy(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """执行样本销毁"""
    if not check_sample_permission(current_user, "destroy"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限执行销毁"
        )
    
    result = await db.execute(
        select(SampleDestroyRequest).where(SampleDestroyRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="销毁申请不存在"
        )
    
    if request.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="销毁申请尚未完成审批"
        )
    
    # 更新申请状态
    request.status = "completed"
    request.executed_by = current_user.id
    request.executed_at = datetime.utcnow()
    
    # 更新样本状态
    result = await db.execute(
        select(SampleDestroyItem).where(SampleDestroyItem.request_id == request_id)
    )
    items = result.scalars().all()
    
    for item in items:
        item.destroyed_at = datetime.utcnow()
        # 更新样本状态
        result = await db.execute(
            select(Sample).where(Sample.id == item.sample_id)
        )
        sample = result.scalar_one_or_none()
        if sample:
            sample.status = SampleStatus.DESTROYED
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="sample_destroy",
        entity_id=request_id,
        action="execute",
        details={
            "sample_count": len(items)
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": f"成功销毁 {len(items)} 个样本"}


# 样本归档相关API（简化流）
@router.post("/archive-request")
async def create_sample_archive_request(
    project_id: int = Form(...),
    sample_codes: str = Form(...),  # JSON数组字符串
    reason: str = Form(""),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """创建样本归档申请"""
    if not check_sample_permission(current_user, "request"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限申请归档")

    try:
        codes = json.loads(sample_codes)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="样本编号格式错误")

    # 生成申请编号
    count = await db.execute(select(func.count()).select_from(SampleArchiveRequest))
    count_value = count.scalar() or 0
    request_code = f"SAR-{datetime.now().strftime('%Y%m%d')}-{count_value + 1:04d}"

    archive_request = SampleArchiveRequest(
        request_code=request_code,
        project_id=project_id,
        requested_by=current_user.id,
        reason=reason,
        status="pending"
    )
    db.add(archive_request)
    await db.commit()
    await db.refresh(archive_request)

    # 添加明细
    for code in codes:
        result = await db.execute(select(Sample).where(Sample.sample_code == code))
        sample = result.scalar_one_or_none()
        if sample:
            item = SampleArchiveItem(request_id=archive_request.id, sample_id=sample.id)
            db.add(item)
    await db.commit()

    # 审计
    db.add(AuditLog(
        user_id=current_user.id,
        entity_type="sample_archive",
        entity_id=archive_request.id,
        action="create",
        details={"project_id": project_id, "count": len(codes)},
        timestamp=datetime.utcnow()
    ))
    await db.commit()

    return {"message": "样本归档申请创建成功", "request_code": request_code}


@router.get("/archive-requests")
async def get_sample_archive_requests(
    status: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(SampleArchiveRequest)
    if status:
        query = query.where(SampleArchiveRequest.status == status)
    result = await db.execute(query.order_by(SampleArchiveRequest.created_at.desc()))
    reqs = result.scalars().all()
    return [
        {
            "id": r.id,
            "request_code": r.request_code,
            "project_id": r.project_id,
            "requested_by": r.requested_by,
            "status": r.status,
            "created_at": r.created_at.isoformat()
        } for r in reqs
    ]


@router.post("/archive-request/{request_id}/execute")
async def execute_sample_archive(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """执行样本归档，将样本状态置为 archived"""
    if current_user.role not in [UserRole.SAMPLE_ADMIN, UserRole.SYSTEM_ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限执行归档")

    result = await db.execute(select(SampleArchiveRequest).where(SampleArchiveRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="归档申请不存在")

    result = await db.execute(select(SampleArchiveItem).where(SampleArchiveItem.request_id == request_id))
    items = result.scalars().all()

    for item in items:
        sres = await db.execute(select(Sample).where(Sample.id == item.sample_id))
        sample = sres.scalar_one_or_none()
        if sample:
            sample.status = SampleStatus.ARCHIVED
            item.archived_at = datetime.utcnow()

    req.status = "completed"
    req.executed_by = current_user.id
    req.executed_at = datetime.utcnow()
    await db.commit()

    db.add(AuditLog(
        user_id=current_user.id,
        entity_type="sample_archive",
        entity_id=request_id,
        action="execute",
        details={"archived": len(items)},
        timestamp=datetime.utcnow()
    ))
    await db.commit()

    return {"message": f"成功归档 {len(items)} 个样本"}
