import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import Base
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import *  # 导入所有模型
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker


async def init_db():
    """初始化数据库"""
    # 创建引擎
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 创建会话
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 检查是否已有管理员用户
        from sqlalchemy import select
        result = await session.execute(
            select(User).where(User.username == "admin")
        )
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            # 创建默认管理员用户
            admin_user = User(
                username="admin",
                email="admin@lims.com",
                full_name="系统管理员",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.SYSTEM_ADMIN,
                is_superuser=True
            )
            session.add(admin_user)
            
            # 创建示例用户
            sample_admin = User(
                username="sample_admin",
                email="sample@lims.com",
                full_name="样本管理员",
                hashed_password=get_password_hash("sample123"),
                role=UserRole.SAMPLE_ADMIN
            )
            session.add(sample_admin)
            
            await session.commit()
            print("✅ 创建默认用户成功")
            print("📌 管理员账号: admin / admin123")
            print("📌 样本管理员: sample_admin / sample123")
        else:
            print("ℹ️ 管理员用户已存在")
    
    await engine.dispose()


if __name__ == "__main__":
    print("🚀 开始初始化数据库...")
    asyncio.run(init_db())
    print("✅ 数据库初始化完成!")
