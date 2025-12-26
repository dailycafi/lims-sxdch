"""为现有用户分配角色"""
import asyncio
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.role import Role


async def migrate_user_roles():
    """为现有用户根据旧的role字段分配新的角色"""
    async with AsyncSessionLocal() as db:
        print("开始迁移用户角色...")
        
        # 获取所有用户
        users_result = await db.execute(select(User))
        users = users_result.scalars().all()
        
        # 获取所有角色
        roles_result = await db.execute(select(Role))
        roles = {role.code: role for role in roles_result.scalars().all()}
        
        print(f"找到 {len(users)} 个用户和 {len(roles)} 个角色")
        
        # 根据旧的role字段分配新角色
        migrated_count = 0
        for user in users:
            if user.role:
                role_code = user.role.value if hasattr(user.role, 'value') else user.role
                if role_code in roles:
                    # 检查用户是否已有角色
                    if not user.roles:
                        user.roles = [roles[role_code]]
                        migrated_count += 1
                        print(f"  为用户 {user.username} 分配角色: {roles[role_code].name}")
                    else:
                        print(f"  用户 {user.username} 已有角色，跳过")
                else:
                    print(f"  ⚠️  警告: 用户 {user.username} 的角色 {role_code} 不存在")
            else:
                print(f"  ⚠️  警告: 用户 {user.username} 没有旧的role字段")
        
        await db.commit()
        print(f"\n✅ 迁移完成！共为 {migrated_count} 个用户分配了角色")


if __name__ == "__main__":
    asyncio.run(migrate_user_roles())

