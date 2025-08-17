from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.sample import Sample, SampleStatus
from app.models.user import User, UserRole
from app.schemas.sample import SampleCreate, SampleUpdate, SampleResponse
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


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


@router.post("/{project_id}/receive")
async def receive_samples(
    project_id: int,
    sample_codes: List[str],
    transport_info: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """接收样本"""
    if not check_sample_permission(current_user, "receive"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以接收样本"
        )
    
    # 更新样本状态为已接收
    result = await db.execute(
        select(Sample).where(
            Sample.project_id == project_id,
            Sample.sample_code.in_(sample_codes)
        )
    )
    samples = result.scalars().all()
    
    if len(samples) != len(sample_codes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="部分样本编号不存在"
        )
    
    for sample in samples:
        sample.status = SampleStatus.RECEIVED
        # TODO: 记录运输信息
    
    await db.commit()
    
    return {"message": f"成功接收 {len(samples)} 个样本"}
