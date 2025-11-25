from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime
from itertools import product

from app.core.database import get_db
from app.models.project import Project
from app.models.sample import (
    Sample,
    SampleReceiveRecord,
    SampleBorrowRequest,
    SampleTransferRecord,
    SampleDestroyRequest,
)
from app.models.deviation import Deviation
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.api.v1.endpoints.auth import get_current_user
from app.core.security import pwd_context

router = APIRouter()


# Pydantic schemas for sample code rule
class SampleCodeRuleUpdate(BaseModel):
    sample_code_rule: dict
    audit_reason: str


def check_project_permission(user: User) -> bool:
    """检查项目管理权限"""
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]
    return user.role in allowed_roles


def is_super_admin(user: User) -> bool:
    """检查是否为超级管理员（可执行特殊删除操作）"""
    return user.role == UserRole.SUPER_ADMIN or user.is_superuser


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


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建新项目（仅样本管理员）"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以创建项目"
        )
    
    # 检查项目编号是否已存在
    result = await db.execute(
        select(Project).where(Project.lab_project_code == project_data.lab_project_code)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="实验室项目编号已存在"
        )
    
    try:
        db_project = Project(
            **project_data.model_dump(),
            created_by=current_user.id
        )
        db.add(db_project)
        await db.commit()
        await db.refresh(db_project)
        return db_project
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建项目失败"
        )


@router.get("/", response_model=List[ProjectResponse])
async def read_projects(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取项目列表"""
    from sqlalchemy.orm import selectinload
    
    query = select(Project).options(
        selectinload(Project.sponsor),
        selectinload(Project.clinical_org)
    )
    if active_only:
        query = query.where(Project.is_active == True)
    
    result = await db.execute(query.offset(skip).limit(limit))
    projects = result.scalars().all()
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def read_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取项目详情"""
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.sponsor))
        .options(selectinload(Project.clinical_org))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新项目信息"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改项目"
        )
    
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 检查是否已有样本，如果有则不能修改编号规则
    if project_update.sample_code_rule is not None:
        # TODO: 检查是否有样本
        pass
    
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)
    return project


@router.post("/{project_id}/archive")
async def archive_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """归档项目"""
    # 权限检查 - 需要通过审批流程
    allowed_roles = [UserRole.SYSTEM_ADMIN]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要系统管理员权限"
        )
    
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    if project.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目已归档"
        )
    
    project.is_archived = True
    project.is_active = False
    
    await db.commit()
    
    return {"message": "项目已归档"}


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除项目（仅系统管理员，可删除无关联数据的项目；超级管理员可强制删除）"""
    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要系统管理员权限"
        )

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 超级管理员可以删除归档项目
    if project.is_archived and not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="归档项目不可删除"
        )

    # 删除前检查是否存在关联数据（超级管理员可跳过检查）
    if not is_super_admin(current_user):
        related_models = [
            (Sample, "样本"),
            (SampleReceiveRecord, "样本接收记录"),
            (SampleBorrowRequest, "样本领用申请"),
            (SampleTransferRecord, "样本转移记录"),
            (SampleDestroyRequest, "样本销毁申请"),
            (Deviation, "偏差记录"),
        ]

        for model, label in related_models:
            result = await db.execute(
                select(func.count()).select_from(model).where(model.project_id == project_id)
            )
            if result.scalar_one() > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"项目存在关联{label}，无法删除"
                )

    try:
        # 超级管理员强制删除时，记录审计日志
        if is_super_admin(current_user):
            await create_audit_log(
                db=db,
                user_id=current_user.id,
                entity_type="project",
                entity_id=project.id,
                action="force_delete",
                details={
                    "project_code": project.lab_project_code,
                    "sponsor_code": project.sponsor_project_code,
                    "is_archived": project.is_archived
                },
                reason="超级管理员强制删除"
            )
        await db.delete(project)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目存在关联数据，无法删除"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{project_id}/sample-code-rule")
async def update_sample_code_rule(
    project_id: int,
    rule_data: SampleCodeRuleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新项目的样本编号规则"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以配置样本编号规则"
        )
    # 二次认证：要求在 audit_reason 中附带 e-signature 密码字段（简单兼容）
    # 例如：{"reason": "修改编号规则", "password": "xxx"}
    # 若前端尚未传此格式，可跳过；未来可切换到独立 verify-signature 接口前置校验
    try:
        if isinstance(rule_data.audit_reason, str) and rule_data.audit_reason.strip().startswith('{'):
            import json as _json
            payload = _json.loads(rule_data.audit_reason)
            password = payload.get('password')
            reason_text = payload.get('reason') or ''
            if not password:
                raise ValueError('missing password')
            if not pwd_context.verify(password, current_user.hashed_password):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="电子签名验证失败")
            # 用纯理由写入审计
            rule_data.audit_reason = reason_text or '更新编号规则'
    except Exception:
        # 兼容旧入参，不阻断（但建议前端改造为显式二次验证）
        pass
    
    # 查找项目
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 检查是否已有样本接收，如果有则不允许修改（超级管理员除外）
    if not is_super_admin(current_user):
        sample_count_result = await db.execute(
            select(func.count()).select_from(Sample).where(Sample.project_id == project_id)
        )
        sample_count = sample_count_result.scalar_one()
        if sample_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"项目已有 {sample_count} 个样本接收，编号规则已锁定，不能修改"
            )
    
    # 记录原始规则
    original_rule = project.sample_code_rule
    
    # 更新规则
    project.sample_code_rule = rule_data.sample_code_rule
    project.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(project)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        action="update_sample_code_rule",
        details={
            "original": original_rule,
            "updated": rule_data.sample_code_rule
        },
        reason=rule_data.audit_reason
    )
    
    return {"message": "样本编号规则已更新", "sample_code_rule": project.sample_code_rule}


@router.post("/{project_id}/generate-sample-codes")
async def generate_sample_codes(
    project_id: int,
    generation_params: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """批量生成样本编号"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以生成样本编号"
        )
    
    # 查找项目
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    if not project.sample_code_rule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先配置样本编号规则"
        )
    
    # 解析参数（容错：字符串以逗号分隔也支持）
    def _parse_list(value):
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str):
            return [v.strip() for v in value.split(',') if v.strip()]
        return []

    cycles = _parse_list(generation_params.get("cycles"))
    test_types = _parse_list(generation_params.get("test_types"))
    primary = _parse_list(generation_params.get("primary"))  # a1,a2
    backup = _parse_list(generation_params.get("backup"))    # b1,b2
    subjects = _parse_list(generation_params.get("subjects"))
    clinic_codes = _parse_list(generation_params.get("clinic_codes")) or [""]

    # 采血序号/时间对 e.g. [{"seq":"01","time":"0h"}]
    seq_time_pairs = generation_params.get("seq_time_pairs") or []
    if isinstance(seq_time_pairs, str):
        # 支持 "01/0h,02/2h"
        pairs = []
        for token in seq_time_pairs.split(','):
            token = token.strip()
            if not token:
                continue
            parts = token.split('/')
            seq = parts[0].strip() if len(parts) > 0 else ""
            tm = parts[1].strip() if len(parts) > 1 else ""
            pairs.append({"seq": seq, "time": tm})
        seq_time_pairs = pairs
    else:
        # 规范化键
        norm = []
        for p in seq_time_pairs:
            if isinstance(p, dict):
                norm.append({"seq": str(p.get("seq", "")).strip(), "time": str(p.get("time", "")).strip()})
        seq_time_pairs = norm

    # 元素顺序来自项目规则
    rule = project.sample_code_rule or {}
    elements = rule.get("elements", [])
    order_map = rule.get("order", {})
    elements = sorted([e for e in elements], key=lambda x: order_map.get(x, 0))

    # 组装可迭代维度（缺省则使用空串以便不参与组合）
    cycles = cycles or [""]
    test_types = test_types or [""]
    primary = primary or []
    backup = backup or []
    subjects = subjects or [""]
    seq_time_pairs = seq_time_pairs or [{"seq": "", "time": ""}]

    # 辅助：根据元素ID返回该部分的字符串
    def _part(el: str, clinic_code: str, subject: str, tt: str, st: dict, cycle: str, stype: str) -> str:
        if el == 'sponsor_code':
            return project.sponsor_project_code or ''
        if el == 'lab_code':
            return project.lab_project_code or ''
        if el == 'clinic_code':
            return clinic_code
        if el == 'subject_id':
            return subject
        if el == 'test_type':
            return tt
        if el == 'sample_seq':
            return st.get('seq', '')
        if el == 'sample_time':
            return st.get('time', '')
        if el == 'cycle_group':
            return cycle
        if el == 'sample_type':
            return stype
        return ''

    generated_codes: list[str] = []

    # 组合：clinic × subject × test_type × seq/time × cycle × sample_type(primary/backup)
    sample_types = primary + backup if (primary or backup) else [""]
    for clinic_code, subject, tt, st, cycle, stype in product(clinic_codes, subjects, test_types, seq_time_pairs, cycles, sample_types):
        parts = [_part(el, clinic_code, subject, tt, st, cycle, stype) for el in elements]
        # 过滤空段（未选择的A-G不显示）
        parts = [p for p in parts if p != ""]
        if not parts:
            continue
        code = "-".join(parts)
        generated_codes.append(code)

    # 去重并限制数量
    unique_codes = list(dict.fromkeys(generated_codes))
    max_count = int(generation_params.get("max_count", 5000))
    unique_codes = unique_codes[:max_count]
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        action="generate_sample_codes",
        details={
            "parameters": {
                "cycles": cycles,
                "test_types": test_types,
                "primary": primary,
                "backup": backup,
                "subjects": subjects,
                "seq_time_pairs": seq_time_pairs,
                "clinic_codes": clinic_codes
            },
            "count": len(unique_codes)
        }
    )
    
    return {
        "message": f"成功生成{len(unique_codes)}个样本编号",
        "sample_codes": unique_codes
    }


@router.post("/{project_id}/import-subjects")
async def import_subjects(
    project_id: int,
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导入受试者编号（Excel），返回受试者编号字符串数组。支持首列为受试者编号，或列名为subject/受试者/受试者编号。"""
    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限")

    try:
        content = await file.read()
        import pandas as _pd
        import io as _io
        df = _pd.read_excel(_io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Excel 解析失败")

    cols = [str(c).strip().lower() for c in df.columns]
    subject_col_idx = 0
    for idx, name in enumerate(cols):
        if name in ["subject", "subject_id", "受试者", "受试者编号", "被试者", "编号"]:
            subject_col_idx = idx
            break

    subjects: List[str] = []
    for val in df.iloc[:, subject_col_idx].astype(str).tolist():
        s = val.strip()
        if not s or s.lower() in ["nan", "none"]:
            continue
        subjects.append(s)

    if not subjects:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未识别到受试者编号")

    # 去重并限制
    subjects = list(dict.fromkeys(subjects))[:5000]
    return {"subjects": subjects}


@router.post("/{project_id}/import-seq-times")
async def import_seq_times(
    project_id: int,
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导入采血序号/时间对（Excel）。支持两列(seq,time)或中文列(序号,时间)，或单列pair如01/0h。"""
    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限")

    try:
        content = await file.read()
        import pandas as _pd
        import io as _io
        df = _pd.read_excel(_io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Excel 解析失败")

    cols = [str(c).strip().lower() for c in df.columns]
    seq_alias = ["seq", "序号", "采血序号", "序"]
    time_alias = ["time", "时间", "采血时间", "时"]

    def _find_col(candidates: List[str]) -> Optional[int]:
        for idx, name in enumerate(cols):
            if name in candidates:
                return idx
        return None

    seq_idx = _find_col(seq_alias)
    time_idx = _find_col(time_alias)

    pairs: List[dict] = []
    if seq_idx is not None and time_idx is not None:
        seq_series = df.iloc[:, seq_idx].astype(str).tolist()
        time_series = df.iloc[:, time_idx].astype(str).tolist()
        for s, t in zip(seq_series, time_series):
            s, t = s.strip(), t.strip()
            if not s or s.lower() in ["nan", "none"]:
                continue
            pairs.append({"seq": s, "time": t})
    else:
        # 尝试单列表达
        for col in df.columns:
            series = df[col].astype(str).tolist()
            for token in series:
                token = token.strip()
                if not token or token.lower() in ["nan", "none"]:
                    continue
                if "/" in token:
                    parts = token.split("/")
                    s = parts[0].strip()
                    t = parts[1].strip() if len(parts) > 1 else ""
                    pairs.append({"seq": s, "time": t})

    if not pairs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未识别到采血序号/时间")

    # 去重并限制
    uniq = []
    seen = set()
    for p in pairs:
        key = (p.get("seq", ""), p.get("time", ""))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
        if len(uniq) >= 5000:
            break
    return {"seq_time_pairs": uniq}


class StabilityQCCodeGenerate(BaseModel):
    """稳定性及质控样本编号生成参数"""
    sample_category: str  # STB 或 QC
    code: str  # 代码，如 L, M, H
    quantity: int  # 数量
    start_number: int = 1  # 起始编号


@router.post("/{project_id}/generate-stability-qc-codes")
async def generate_stability_qc_codes(
    project_id: int,
    params: StabilityQCCodeGenerate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """生成稳定性及质控样本编号"""
    # 检查权限
    if current_user.role not in [UserRole.SAMPLE_ADMIN, UserRole.SYSTEM_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以生成样本编号"
        )
    
    # 获取项目
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 生成编号
    # 格式：临床试验研究室项目编号-样本类别-代码-序号
    # 例如：L2501-STB-L-31
    sample_codes = []
    for i in range(params.quantity):
        code_number = params.start_number + i
        sample_code = f"{project.lab_project_code}-{params.sample_category}-{params.code}-{code_number}"
        sample_codes.append(sample_code)
    
    # 记录审计日志
    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project_id,
        action="generate_stability_qc_codes",
        details={
            "project_code": project.lab_project_code,
            "sample_category": params.sample_category,
            "code": params.code,
            "quantity": params.quantity,
            "start_number": params.start_number,
            "generated_codes": sample_codes[:10]  # 只记录前10个
        }
    )
    
    return {
        "sample_codes": sample_codes,
        "count": len(sample_codes)
    }
