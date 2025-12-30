"""
初始化组织类型数据
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import engine, AsyncSessionLocal
from app.models.global_params import OrganizationType


async def init_organization_types():
    """初始化默认的组织类型"""
    
    # 默认的组织类型
    default_types = [
        {"value": "sponsor", "label": "申办方", "display_order": 1, "is_system": True},
        {"value": "clinical", "label": "临床机构", "display_order": 2, "is_system": True},
        {"value": "testing", "label": "检测单位", "display_order": 3, "is_system": True},
        {"value": "transport", "label": "运输单位", "display_order": 4, "is_system": True},
    ]
    
    async with AsyncSessionLocal() as session:
        try:
            for type_data in default_types:
                # 检查是否已存在
                result = await session.execute(
                    select(OrganizationType).where(OrganizationType.value == type_data["value"])
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # 更新现有记录
                    existing.label = type_data["label"]
                    existing.display_order = type_data["display_order"]
                    existing.is_system = type_data["is_system"]
                    existing.is_active = True
                    print(f"✓ 更新组织类型: {type_data['label']}")
                else:
                    # 创建新记录
                    org_type = OrganizationType(**type_data)
                    session.add(org_type)
                    print(f"✓ 创建组织类型: {type_data['label']}")
            
            await session.commit()
            print("\n组织类型初始化完成！")
            
        except Exception as e:
            await session.rollback()
            print(f"✗ 初始化失败: {str(e)}")
            raise


async def main():
    """主函数"""
    print("开始初始化组织类型...")
    print("-" * 50)
    
    await init_organization_types()
    
    print("-" * 50)
    print("完成！")


if __name__ == "__main__":
    asyncio.run(main())

