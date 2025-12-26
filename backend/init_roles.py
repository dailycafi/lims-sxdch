"""初始化角色和权限数据"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.role import Role, Permission


# 定义权限列表
PERMISSIONS = [
    # 用户管理
    {"code": "user.view", "name": "查看用户", "module": "user", "description": "查看用户列表和详情"},
    {"code": "user.create", "name": "创建用户", "module": "user", "description": "创建新用户"},
    {"code": "user.edit", "name": "编辑用户", "module": "user", "description": "编辑用户信息"},
    {"code": "user.delete", "name": "删除用户", "module": "user", "description": "删除用户"},
    {"code": "user.reset_password", "name": "重置密码", "module": "user", "description": "重置用户密码"},
    
    # 角色管理
    {"code": "role.view", "name": "查看角色", "module": "role", "description": "查看角色列表和详情"},
    {"code": "role.create", "name": "创建角色", "module": "role", "description": "创建新角色"},
    {"code": "role.edit", "name": "编辑角色", "module": "role", "description": "编辑角色信息和权限"},
    {"code": "role.delete", "name": "删除角色", "module": "role", "description": "删除角色"},
    
    # 样本管理
    {"code": "sample.view", "name": "查看样本", "module": "sample", "description": "查看样本列表和详情"},
    {"code": "sample.create", "name": "创建样本", "module": "sample", "description": "创建新样本"},
    {"code": "sample.edit", "name": "编辑样本", "module": "sample", "description": "编辑样本信息"},
    {"code": "sample.delete", "name": "删除样本", "module": "sample", "description": "删除样本"},
    {"code": "sample.receive", "name": "接收样本", "module": "sample", "description": "样本接收入库"},
    {"code": "sample.borrow", "name": "借用样本", "module": "sample", "description": "申请借用样本"},
    {"code": "sample.return", "name": "归还样本", "module": "sample", "description": "归还借用的样本"},
    {"code": "sample.transfer", "name": "转移样本", "module": "sample", "description": "样本转移操作"},
    {"code": "sample.destroy", "name": "销毁样本", "module": "sample", "description": "样本销毁操作"},
    
    # 项目管理
    {"code": "project.view", "name": "查看项目", "module": "project", "description": "查看项目列表和详情"},
    {"code": "project.create", "name": "创建项目", "module": "project", "description": "创建新项目"},
    {"code": "project.edit", "name": "编辑项目", "module": "project", "description": "编辑项目信息"},
    {"code": "project.delete", "name": "删除项目", "module": "project", "description": "删除项目"},
    {"code": "project.archive", "name": "归档项目", "module": "project", "description": "归档项目"},
    
    # 存储管理
    {"code": "storage.view", "name": "查看存储", "module": "storage", "description": "查看存储设备和位置"},
    {"code": "storage.create", "name": "创建存储", "module": "storage", "description": "创建存储设备"},
    {"code": "storage.edit", "name": "编辑存储", "module": "storage", "description": "编辑存储信息"},
    {"code": "storage.delete", "name": "删除存储", "module": "storage", "description": "删除存储设备"},
    
    # 全局参数
    {"code": "global_params.view", "name": "查看参数", "module": "global_params", "description": "查看全局参数配置"},
    {"code": "global_params.edit", "name": "编辑参数", "module": "global_params", "description": "编辑全局参数配置"},
    
    # 偏差管理
    {"code": "deviation.view", "name": "查看偏差", "module": "deviation", "description": "查看偏差记录"},
    {"code": "deviation.create", "name": "创建偏差", "module": "deviation", "description": "创建偏差记录"},
    {"code": "deviation.edit", "name": "编辑偏差", "module": "deviation", "description": "编辑偏差记录"},
    {"code": "deviation.approve", "name": "审批偏差", "module": "deviation", "description": "审批偏差记录"},
    
    # 审计日志
    {"code": "audit.view", "name": "查看日志", "module": "audit", "description": "查看审计日志"},
    
    # 统计查询
    {"code": "statistics.view", "name": "查看统计", "module": "statistics", "description": "查看统计数据"},
]


# 定义角色及其权限
ROLES = [
    {
        "code": "system_admin",
        "name": "系统管理员",
        "description": "拥有系统所有权限，可以管理用户、角色和系统配置",
        "is_system": True,
        "permissions": [p["code"] for p in PERMISSIONS]  # 所有权限
    },
    {
        "code": "lab_director",
        "name": "研究室主任",
        "description": "实验室负责人，可以查看所有数据，审批偏差",
        "is_system": True,
        "permissions": [
            "sample.view", "project.view", "storage.view", 
            "deviation.view", "deviation.approve", "audit.view", "statistics.view"
        ]
    },
    {
        "code": "test_manager",
        "name": "分析测试主管",
        "description": "测试部门主管，管理测试项目和样本",
        "is_system": True,
        "permissions": [
            "sample.view", "sample.create", "sample.edit", 
            "project.view", "project.create", "project.edit",
            "storage.view", "deviation.view", "deviation.create", "statistics.view"
        ]
    },
    {
        "code": "sample_admin",
        "name": "样本管理员",
        "description": "负责样本的全生命周期管理",
        "is_system": True,
        "permissions": [
            "sample.view", "sample.create", "sample.edit", "sample.delete",
            "sample.receive", "sample.borrow", "sample.return", 
            "sample.transfer", "sample.destroy",
            "storage.view", "storage.create", "storage.edit",
            "project.view", "statistics.view"
        ]
    },
    {
        "code": "project_lead",
        "name": "项目负责人",
        "description": "负责项目管理和样本查看",
        "is_system": True,
        "permissions": [
            "project.view", "project.create", "project.edit",
            "sample.view", "sample.borrow", "sample.return",
            "storage.view", "statistics.view"
        ]
    },
    {
        "code": "analyst",
        "name": "分析测试员",
        "description": "执行测试任务，查看样本和项目",
        "is_system": True,
        "permissions": [
            "sample.view", "project.view", "storage.view"
        ]
    },
    {
        "code": "qa",
        "name": "质量管理员",
        "description": "负责质量管理和偏差处理",
        "is_system": True,
        "permissions": [
            "sample.view", "project.view", 
            "deviation.view", "deviation.create", "deviation.edit", "deviation.approve",
            "audit.view", "statistics.view"
        ]
    },
]


async def init_roles_and_permissions():
    """初始化角色和权限"""
    async with AsyncSessionLocal() as db:
        print("开始初始化角色和权限...")
        
        # 1. 创建或更新权限
        print("\n创建权限...")
        permission_map = {}
        for perm_data in PERMISSIONS:
            result = await db.execute(
                select(Permission).where(Permission.code == perm_data["code"])
            )
            permission = result.scalar_one_or_none()
            
            if permission:
                # 更新现有权限
                for key, value in perm_data.items():
                    setattr(permission, key, value)
                print(f"  更新权限: {perm_data['code']} - {perm_data['name']}")
            else:
                # 创建新权限
                permission = Permission(**perm_data)
                db.add(permission)
                print(f"  创建权限: {perm_data['code']} - {perm_data['name']}")
            
            permission_map[perm_data["code"]] = permission
        
        await db.commit()
        
        # 刷新所有权限以获取ID
        for permission in permission_map.values():
            await db.refresh(permission)
        
        # 2. 创建或更新角色
        print("\n创建角色...")
        for role_data in ROLES:
            result = await db.execute(
                select(Role).where(Role.code == role_data["code"])
            )
            role = result.scalar_one_or_none()
            
            # 获取权限对象
            role_permissions = [
                permission_map[code] 
                for code in role_data["permissions"] 
                if code in permission_map
            ]
            
            if role:
                # 更新现有角色
                role.name = role_data["name"]
                role.description = role_data["description"]
                role.permissions = role_permissions
                print(f"  更新角色: {role_data['code']} - {role_data['name']} ({len(role_permissions)}个权限)")
            else:
                # 创建新角色
                role = Role(
                    code=role_data["code"],
                    name=role_data["name"],
                    description=role_data["description"],
                    is_system=role_data["is_system"]
                )
                role.permissions = role_permissions
                db.add(role)
                print(f"  创建角色: {role_data['code']} - {role_data['name']} ({len(role_permissions)}个权限)")
        
        await db.commit()
        print("\n✅ 角色和权限初始化完成！")


if __name__ == "__main__":
    asyncio.run(init_roles_and_permissions())

