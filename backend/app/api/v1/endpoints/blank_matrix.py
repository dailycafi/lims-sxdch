"""空白基质 API 端点"""
from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from pydantic import BaseModel
import json
import os
import uuid

from app.core.database import get_db
from app.models.blank_matrix import (
    BlankMatrixReceiveRecord,
    BlankMatrixSample,
    BlankMatrixStatus,
)
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.models.project import Project
from app.api.v1.endpoints.auth import get_current_user
from app.schemas.blank_matrix import (
    BlankMatrixReceiveCreate,
    BlankMatrixReceiveResponse,
    BlankMatrixSampleResponse,
    BlankMatrixInventoryCreate,
    BlankMatrixSampleUpdate,
)
from app.api.v1.deps import assert_project_access, get_accessible_project_ids

router = APIRouter()

# 文件上传目录
UPLOAD_DIR = "uploads/blank_matrix"


def ensure_upload_dir():
    """确保上传目录存在"""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(f"{UPLOAD_DIR}/consent", exist_ok=True)
    os.makedirs(f"{UPLOAD_DIR}/ethics", exist_ok=True)
    os.makedirs(f"{UPLOAD_DIR}/medical_reports", exist_ok=True)


def check_blank_matrix_permission(user: User, action: str = "read") -> bool:
    """检查空白基质操作权限"""
    if action == "read":
        return True

    if action in ["create", "receive", "inventory"]:
        return user.role in [UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]

    if action in ["request", "borrow", "return", "transfer", "destroy"]:
        allowed_roles = [
            UserRole.SYSTEM_ADMIN,
            UserRole.SAMPLE_ADMIN,
            UserRole.PROJECT_LEAD,
            UserRole.ANALYST
        ]
        return user.role in allowed_roles

    return False


async def generate_blank_matrix_code(
    db: AsyncSession,
    project_code: str,
    anticoagulant: str,
    sequence: int
) -> str:
    """
    生成空白基质编号
    格式: {项目编码}-BP-{年份后两位}{序号3位}-{抗凝剂}-{份数}
    示例: CRC-BP-26001-E-05
    """
    year_suffix = datetime.now().strftime("%y")
    seq_str = f"{sequence:03d}"

    # 抗凝剂缩写映射
    anticoagulant_abbr = {
        "EDTA": "E",
        "heparin_sodium": "H",
        "sodium_citrate": "C",
    }
    abbr = anticoagulant_abbr.get(anticoagulant, "X")

    # 默认份数为 01
    return f"{project_code}-BP-{year_suffix}{seq_str}-{abbr}-01"


async def get_next_sequence(db: AsyncSession, project_id: int) -> int:
    """获取下一个序列号"""
    result = await db.execute(
        select(func.count(BlankMatrixSample.id))
        .where(BlankMatrixSample.project_id == project_id)
    )
    count = result.scalar() or 0
    return count + 1


@router.post("/receive")
async def receive_blank_matrix(
    project_id: int = Form(...),
    source_name: str = Form(...),
    source_contact: Optional[str] = Form(None),
    source_phone: Optional[str] = Form(None),
    anticoagulants: str = Form(...),  # JSON array string
    matrix_type: str = Form(...),
    matrix_type_other: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    consent_files: List[UploadFile] = File(default=[]),
    ethics_files: List[UploadFile] = File(default=[]),
    medical_report_files: List[UploadFile] = File(default=[]),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """接收空白基质样本"""
    if not check_blank_matrix_permission(current_user, "receive"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有接收空白基质的权限"
        )

    # 验证项目存在
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    ensure_upload_dir()

    # 解析抗凝剂类型
    try:
        anticoagulants_list = json.loads(anticoagulants)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="抗凝剂类型格式错误"
        )

    # 保存上传的文件
    async def save_files(files: List[UploadFile], subdir: str) -> List[str]:
        paths = []
        for file in files:
            if file.filename:
                ext = os.path.splitext(file.filename)[1]
                filename = f"{uuid.uuid4()}{ext}"
                filepath = f"{UPLOAD_DIR}/{subdir}/{filename}"
                content = await file.read()
                with open(filepath, "wb") as f:
                    f.write(content)
                paths.append(filepath)
        return paths

    consent_paths = await save_files(consent_files, "consent")
    ethics_paths = await save_files(ethics_files, "ethics")
    medical_paths = await save_files(medical_report_files, "medical_reports")

    # 创建接收记录
    receive_record = BlankMatrixReceiveRecord(
        project_id=project_id,
        source_name=source_name,
        source_contact=source_contact,
        source_phone=source_phone,
        consent_files=consent_paths if consent_paths else None,
        ethics_files=ethics_paths if ethics_paths else None,
        medical_report_files=medical_paths if medical_paths else None,
        anticoagulants=anticoagulants_list,
        matrix_type=matrix_type,
        matrix_type_other=matrix_type_other,
        notes=notes,
        received_by=current_user.id,
        received_at=datetime.now(),
        status="pending"
    )

    db.add(receive_record)
    await db.commit()
    await db.refresh(receive_record)

    # 记录审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        action="blank_matrix_receive",
        resource_type="blank_matrix_receive_record",
        resource_id=receive_record.id,
        details=f"接收空白基质, 来源: {source_name}, 基质类型: {matrix_type}"
    )
    db.add(audit_log)
    await db.commit()

    return {
        "success": True,
        "message": "空白基质接收成功，已生成清点任务",
        "receive_record_id": receive_record.id
    }


@router.get("/receive/tasks", response_model=List[BlankMatrixReceiveResponse])
async def get_receive_tasks(
    project_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取空白基质接收任务列表"""
    query = select(BlankMatrixReceiveRecord).options(
        selectinload(BlankMatrixReceiveRecord.project),
        selectinload(BlankMatrixReceiveRecord.receiver),
        selectinload(BlankMatrixReceiveRecord.samples)
    )

    # 获取用户可访问的项目
    accessible_project_ids = await get_accessible_project_ids(db, current_user)
    if accessible_project_ids is not None:
        query = query.where(BlankMatrixReceiveRecord.project_id.in_(accessible_project_ids))

    if project_id:
        query = query.where(BlankMatrixReceiveRecord.project_id == project_id)

    if status_filter:
        query = query.where(BlankMatrixReceiveRecord.status == status_filter)

    query = query.order_by(BlankMatrixReceiveRecord.received_at.desc())

    result = await db.execute(query)
    records = result.scalars().all()

    return [
        BlankMatrixReceiveResponse(
            id=r.id,
            project_id=r.project_id,
            project_name=r.project.name if r.project else None,
            source_name=r.source_name,
            source_contact=r.source_contact,
            source_phone=r.source_phone,
            consent_files=r.consent_files,
            ethics_files=r.ethics_files,
            medical_report_files=r.medical_report_files,
            anticoagulants=r.anticoagulants or [],
            matrix_type=r.matrix_type,
            matrix_type_other=r.matrix_type_other,
            received_by=r.received_by,
            received_by_name=r.receiver.full_name if r.receiver else None,
            received_at=r.received_at,
            status=r.status,
            notes=r.notes,
            sample_count=len(r.samples) if r.samples else 0,
            created_at=r.created_at,
            updated_at=r.updated_at
        )
        for r in records
    ]


@router.get("/receive/{record_id}")
async def get_receive_record(
    record_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取单个接收记录详情"""
    query = select(BlankMatrixReceiveRecord).options(
        selectinload(BlankMatrixReceiveRecord.project),
        selectinload(BlankMatrixReceiveRecord.receiver),
        selectinload(BlankMatrixReceiveRecord.samples)
    ).where(BlankMatrixReceiveRecord.id == record_id)

    result = await db.execute(query)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="接收记录不存在"
        )

    return {
        "id": record.id,
        "project_id": record.project_id,
        "project_name": record.project.name if record.project else None,
        "project_code": record.project.code if record.project else None,
        "source_name": record.source_name,
        "source_contact": record.source_contact,
        "source_phone": record.source_phone,
        "consent_files": record.consent_files,
        "ethics_files": record.ethics_files,
        "medical_report_files": record.medical_report_files,
        "anticoagulants": record.anticoagulants or [],
        "matrix_type": record.matrix_type,
        "matrix_type_other": record.matrix_type_other,
        "received_by": record.received_by,
        "received_by_name": record.receiver.full_name if record.receiver else None,
        "received_at": record.received_at.isoformat() if record.received_at else None,
        "status": record.status,
        "notes": record.notes,
        "samples": [
            {
                "id": s.id,
                "sample_code": s.sample_code,
                "anticoagulant": s.anticoagulant,
                "edta_volume": float(s.edta_volume) if s.edta_volume else None,
                "heparin_volume": float(s.heparin_volume) if s.heparin_volume else None,
                "citrate_volume": float(s.citrate_volume) if s.citrate_volume else None,
                "special_notes": s.special_notes,
                "status": s.status,
            }
            for s in record.samples
        ] if record.samples else [],
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


@router.post("/inventory")
async def inventory_blank_matrix(
    data: BlankMatrixInventoryCreate,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """清点/入库空白基质样本"""
    if not check_blank_matrix_permission(current_user, "inventory"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有清点空白基质的权限"
        )

    # 获取接收记录
    record = await db.get(BlankMatrixReceiveRecord, data.receive_record_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="接收记录不存在"
        )

    # 获取项目信息用于生成编号
    project = await db.get(Project, record.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    project_code = project.code or "UNK"

    # 创建或更新样本记录
    created_samples = []
    for idx, sample_data in enumerate(data.samples):
        # 检查是否已存在该编号的样本
        existing_query = select(BlankMatrixSample).where(
            BlankMatrixSample.sample_code == sample_data.sample_code
        )
        existing_result = await db.execute(existing_query)
        existing_sample = existing_result.scalar_one_or_none()

        if existing_sample:
            # 更新现有样本
            existing_sample.edta_volume = sample_data.edta_volume
            existing_sample.heparin_volume = sample_data.heparin_volume
            existing_sample.citrate_volume = sample_data.citrate_volume
            existing_sample.special_notes = sample_data.special_notes
            if data.is_final:
                existing_sample.status = BlankMatrixStatus.IN_STORAGE.value
                existing_sample.inventoried_by = current_user.id
                existing_sample.inventoried_at = datetime.now()
            created_samples.append(existing_sample)
        else:
            # 创建新样本
            sample = BlankMatrixSample(
                sample_code=sample_data.sample_code,
                receive_record_id=data.receive_record_id,
                project_id=record.project_id,
                anticoagulant=sample_data.anticoagulant,
                matrix_type=record.matrix_type,
                edta_volume=sample_data.edta_volume,
                heparin_volume=sample_data.heparin_volume,
                citrate_volume=sample_data.citrate_volume,
                special_notes=sample_data.special_notes,
                status=BlankMatrixStatus.IN_STORAGE.value if data.is_final else BlankMatrixStatus.INVENTORIED.value,
                inventoried_by=current_user.id if data.is_final else None,
                inventoried_at=datetime.now() if data.is_final else None,
            )
            db.add(sample)
            created_samples.append(sample)

    # 更新接收记录状态
    if data.is_final:
        record.status = "completed"
    else:
        record.status = "in_progress"

    await db.commit()

    # 记录审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        action="blank_matrix_inventory" if data.is_final else "blank_matrix_temp_save",
        resource_type="blank_matrix_receive_record",
        resource_id=record.id,
        details=f"{'入库' if data.is_final else '暂存'}空白基质 {len(data.samples)} 份"
    )
    db.add(audit_log)
    await db.commit()

    return {
        "success": True,
        "message": f"空白基质{'入库' if data.is_final else '暂存'}成功",
        "sample_count": len(created_samples)
    }


@router.get("/samples", response_model=List[BlankMatrixSampleResponse])
async def get_blank_matrix_samples(
    project_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    receive_record_id: Optional[int] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取空白基质样本列表"""
    query = select(BlankMatrixSample)

    # 获取用户可访问的项目
    accessible_project_ids = await get_accessible_project_ids(db, current_user)
    if accessible_project_ids is not None:
        query = query.where(BlankMatrixSample.project_id.in_(accessible_project_ids))

    if project_id:
        query = query.where(BlankMatrixSample.project_id == project_id)

    if status_filter:
        query = query.where(BlankMatrixSample.status == status_filter)

    if receive_record_id:
        query = query.where(BlankMatrixSample.receive_record_id == receive_record_id)

    query = query.order_by(BlankMatrixSample.created_at.desc())

    result = await db.execute(query)
    samples = result.scalars().all()

    return samples


@router.post("/generate-codes")
async def generate_blank_matrix_codes(
    project_code: str = Form(...),
    anticoagulant: str = Form(...),
    count: int = Form(1),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """生成空白基质编号"""
    if count < 1 or count > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="生成数量必须在 1-100 之间"
        )

    # 获取当前年份最大序号
    year_prefix = datetime.now().strftime("%y")
    pattern = f"{project_code}-BP-{year_prefix}%"

    result = await db.execute(
        select(BlankMatrixSample.sample_code)
        .where(BlankMatrixSample.sample_code.like(pattern))
        .order_by(BlankMatrixSample.sample_code.desc())
        .limit(1)
    )
    last_code = result.scalar_one_or_none()

    if last_code:
        # 解析序号
        try:
            parts = last_code.split("-")
            seq_part = parts[2]  # e.g., "26001"
            last_seq = int(seq_part[2:])  # 去掉年份前两位
        except (IndexError, ValueError):
            last_seq = 0
    else:
        last_seq = 0

    # 抗凝剂缩写映射
    anticoagulant_abbr = {
        "EDTA": "E",
        "heparin_sodium": "H",
        "sodium_citrate": "C",
    }
    abbr = anticoagulant_abbr.get(anticoagulant, "X")

    # 生成编号
    codes = []
    for i in range(count):
        seq = last_seq + i + 1
        code = f"{project_code}-BP-{year_prefix}{seq:03d}-{abbr}-01"
        codes.append(code)

    return {"codes": codes}


@router.get("/matrix-types")
async def get_matrix_types(
    current_user: Annotated[User, Depends(get_current_user)] = None,
):
    """获取基质类型选项"""
    return {
        "anticoagulants": [
            {"value": "EDTA", "label": "EDTA"},
            {"value": "heparin_sodium", "label": "肝素钠"},
            {"value": "sodium_citrate", "label": "枸橼酸钠"},
        ],
        "matrix_types": [
            {"value": "whole_blood", "label": "全血"},
            {"value": "plasma", "label": "血浆"},
            {"value": "serum", "label": "血清"},
            {"value": "urine", "label": "尿液"},
            {"value": "feces", "label": "粪便"},
            {"value": "csf", "label": "脑脊液"},
            {"value": "other", "label": "其它"},
        ]
    }
