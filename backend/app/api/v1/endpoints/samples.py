from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from pydantic import BaseModel
import json

from app.core.database import get_db
from app.models.sample import Sample, SampleStatus, SampleReceiveRecord, SampleBorrowRequest, SampleBorrowItem, SampleTransferRecord, SampleTransferItem, SampleDestroyRequest, SampleDestroyItem
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.sample import SampleCreate, SampleUpdate, SampleResponse
from app.api.v1.endpoints.auth import get_current_user

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


@router.get("/{sample_code}", response_model=SampleResponse)
async def read_sample(
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
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """接收样本，创建接收记录"""
    if not check_sample_permission(current_user, "receive"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以接收样本"
        )
    
    # 保存温度文件
    temperature_file_path = None
    if temperature_file:
        # 创建上传目录
        import os
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
    
    # TODO: 创建样本记录，关联样本盒
    for sample_data in samples:
        if sample_data["status"] == "scanned":
            sample = Sample(
                sample_code=sample_data["code"],
                project_id=record.project_id,
                status=SampleStatus.IN_STORAGE,
                box_code=sample_data.get("boxCode"),
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
            selectinload(SampleBorrowRequest.samples).selectinload(SampleBorrowItem.sample)
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
        # TODO: 实现文件保存逻辑
        approval_file_path = f"uploads/approvals/transfer_{datetime.now().timestamp()}"
    
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
        # TODO: 实现文件保存逻辑
        approval_file_path = f"uploads/approvals/destroy_{datetime.now().timestamp()}"
    
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
