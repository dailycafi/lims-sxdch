import asyncio
import bcrypt
# 修复 passlib 与 bcrypt 4.0+ 的兼容性问题
if not hasattr(bcrypt, '__about__'):
    bcrypt.__about__ = type('about', (object,), {'__version__': bcrypt.__version__})

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text, inspect
from app.core.database import Base
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import *  # 导入所有模型
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta, UTC
import random


async def drop_all_tables(engine):
    """删除所有表"""
    async with engine.begin() as conn:
        print("🗑️  正在删除所有数据表...")
        
        # 获取所有表名并使用 CASCADE 删除（解决循环依赖问题）
        def get_table_names(sync_conn):
            inspector = inspect(sync_conn)
            return inspector.get_table_names()
        
        tables = await conn.run_sync(get_table_names)
        
        if tables:
            print(f"   找到 {len(tables)} 个表，正在删除...")
            for table in tables:
                try:
                    await conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                    print(f"   ✓ 已删除表: {table}")
                except Exception as e:
                    print(f"   ⚠ 删除表 {table} 时出错: {e}")
        else:
            print("   没有找到需要删除的表")
    
    print("✅ 已完成数据表清理")


async def init_db(drop_existing=False):
    """初始化数据库"""
    # 创建引擎
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    if drop_existing:
        await drop_all_tables(engine)
    
    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 创建会话
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("Creating Organizations...")
        # 1. 创建组织机构
        from app.models.global_params import Organization, GlobalConfiguration, SystemSetting
        
        print("Creating System Settings...")
        # 0. 创建系统设置
        session.add_all([
            SystemSetting(key="session_timeout", value=30, description="自动登出时间（分钟）"),
            SystemSetting(key="password_complexity_enabled", value=True, description="是否启用密码复杂度校验")
        ])
        await session.flush()

        print("Initializing Roles and Permissions...")
        # 0.1 初始化角色和权限 (逻辑提取自 init_roles.py)
        from app.models.role import Role, Permission
        from init_roles import PERMISSIONS, ROLES
        
        # 创建或更新权限
        permission_map = {}
        for perm_data in PERMISSIONS:
            permission = Permission(**perm_data)
            session.add(permission)
            permission_map[perm_data["code"]] = permission
        
        await session.flush()
        
        # 创建或更新角色
        role_objects_map = {}
        for role_data in ROLES:
            role_permissions = [
                permission_map[code] 
                for code in role_data["permissions"] 
                if code in permission_map
            ]
            role = Role(
                code=role_data["code"],
                name=role_data["name"],
                description=role_data["description"],
                is_system=role_data["is_system"]
            )
            role.permissions = role_permissions
            session.add(role)
            role_objects_map[role_data["code"]] = role
        
        await session.flush()
        
        # 申办方
        sponsor1 = Organization(
            name="诺华制药",
            org_type="sponsor",
            address="上海市浦东新区",
            contact_person="张经理",
            contact_phone="021-12345678",
            contact_email="contact@novartis.com"
        )
        sponsor2 = Organization(
            name="罗氏制药",
            org_type="sponsor",
            address="上海市张江高科",
            contact_person="李经理",
            contact_phone="021-87654321",
            contact_email="contact@roche.com"
        )
        
        # 临床机构
        clinical1 = Organization(
            name="上海徐汇区中心医院",
            org_type="clinical",
            address="上海市徐汇区",
            contact_person="王主任",
            contact_phone="021-11111111",
            contact_email="clinical@xhch.com"
        )
        clinical2 = Organization(
            name="北京协和医院",
            org_type="clinical",
            address="北京市东城区",
            contact_person="刘主任",
            contact_phone="010-22222222",
            contact_email="clinical@bjxh.com"
        )
        
        # 运输公司
        transport1 = Organization(
            name="顺丰速运",
            org_type="transport",
            address="全国",
            contact_person="客服",
            contact_phone="95338",
            contact_email="service@sf-express.com"
        )
        transport2 = Organization(
            name="京东物流",
            org_type="transport",
            address="全国",
            contact_person="客服",
            contact_phone="950616",
            contact_email="service@jd.com"
        )
        
        session.add_all([sponsor1, sponsor2, clinical1, clinical2, transport1, transport2])
        await session.flush()
        
        print("Creating Global Configurations...")
        # 1.1 创建全局配置
        config1 = GlobalConfiguration(
            name="标准临床试验配置",
            category="project_template",
            description="适用于大多数I/II期临床试验的标准配置",
            config_data={
                "sample_types": ["PK", "ADA", "Biomarker"],
                "visits": ["Screening", "Day 1", "Day 8", "EOT", "Follow-up"],
                "label_template": "standard_v1"
            }
        )
        session.add(config1)
        await session.flush()

        # 1.2 创建存储结构 (冰箱 -> 层 -> 架 -> 盒)
        print("Creating Storage Hierarchy...")
        from app.models.storage import StorageFreezer, StorageShelf, StorageRack, StorageBox

        # 创建一个 -80度冰箱
        freezer1 = StorageFreezer(
            name="F-80-01",
            barcode="F-80-01",
            location="Room 101",
            temperature=-80.0,
            description="主样本库冰箱",
            total_shelves=4
        )
        session.add(freezer1)
        await session.flush()

        # 创建4层
        shelves = []
        for i in range(1, 5):
            shelf = StorageShelf(
                freezer_id=freezer1.id,
                name=f"Layer {i}",
                barcode=f"F-80-01-L{i}",
                level_order=i
            )
            shelves.append(shelf)
        session.add_all(shelves)
        await session.flush()

        # 在第一层创建4个架子
        racks = []
        shelf1 = shelves[0]
        for i in range(1, 5):
            rack = StorageRack(
                shelf_id=shelf1.id,
                name=f"Rack {chr(64+i)}", # Rack A, B, C, D
                barcode=f"RACK-{i:03d}",
                row_capacity=5,
                col_capacity=5
            )
            racks.append(rack)
        session.add_all(racks)
        await session.flush()

        # 在第一个架子上创建一些盒子
        boxes = []
        rack1 = racks[0]
        for i in range(1, 6):
            box = StorageBox(
                rack_id=rack1.id,
                name=f"Box {i}",
                barcode=f"BOX-{i:03d}",
                box_type="9x9",
                rows=9,
                cols=9
            )
            boxes.append(box)
        session.add_all(boxes)
        await session.flush()
        
        print("Creating Users...")
        # 2. 创建用户
        from app.models.user import User, UserRole
        
        # 系统管理员
        admin_user = User(
            username="admin",
            email="admin@lims.com",
            full_name="系统管理员",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.SYSTEM_ADMIN,
            is_superuser=True
        )
        if 'system_admin' in role_objects_map:
            admin_user.roles = [role_objects_map['system_admin']]
        
        # 样本管理员
        sample_admin = User(
            username="sample_admin",
            email="sample@lims.com",
            full_name="样本管理员",
            hashed_password=get_password_hash("sample123"),
            role=UserRole.SAMPLE_ADMIN
        )
        if 'sample_admin' in role_objects_map:
            sample_admin.roles = [role_objects_map['sample_admin']]
        
        # 项目负责人
        project_lead = User(
            username="project_lead",
            email="project@lims.com",
            full_name="项目负责人",
            hashed_password=get_password_hash("project123"),
            role=UserRole.PROJECT_LEAD
        )
        if 'project_lead' in role_objects_map:
            project_lead.roles = [role_objects_map['project_lead']]
        
        # 分析测试主管
        test_manager = User(
            username="test_manager",
            email="test@lims.com",
            full_name="分析测试主管",
            hashed_password=get_password_hash("test123"),
            role=UserRole.TEST_MANAGER
        )
        if 'test_manager' in role_objects_map:
            test_manager.roles = [role_objects_map['test_manager']]
        
        # 研究室主任
        lab_director = User(
            username="lab_director",
            email="director@lims.com",
            full_name="研究室主任",
            hashed_password=get_password_hash("director123"),
            role=UserRole.LAB_DIRECTOR
        )
        if 'lab_director' in role_objects_map:
            lab_director.roles = [role_objects_map['lab_director']]
        
        # 分析员
        analyst = User(
            username="analyst",
            email="analyst@lims.com",
            full_name="分析员",
            hashed_password=get_password_hash("analyst123"),
            role=UserRole.ANALYST
        )
        if 'analyst' in role_objects_map:
            analyst.roles = [role_objects_map['analyst']]
        
        session.add_all([admin_user, sample_admin, project_lead, test_manager, lab_director, analyst])
        await session.flush()
        
        print("Creating Projects...")
        # 3. 创建项目
        from app.models.project import Project
        
        project1 = Project(
            sponsor_project_code="NOV-2024-001",
            lab_project_code="L2401-NOV",
            sponsor_id=sponsor1.id,
            clinical_org_id=clinical1.id,
            sample_code_rule={
                "prefix": "L2401",
                "include_site": True,
                "include_subject": True,
                "include_timepoint": True,
                "separator": "-"
            },
            created_by=admin_user.id
        )
        
        project2 = Project(
            sponsor_project_code="ROC-2024-002",
            lab_project_code="L2402-ROC",
            sponsor_id=sponsor2.id,
            clinical_org_id=clinical2.id,
            sample_code_rule={
                "prefix": "L2402",
                "include_site": True,
                "include_subject": True,
                "include_timepoint": True,
                "separator": "-"
            },
            created_by=admin_user.id
        )
        
        session.add_all([project1, project2])
        await session.flush()
        
        # 绑定盒子到项目
        boxes[0].project_id = project2.id
        session.add(boxes[0])
        await session.flush()
        
        # 4. 创建样本接收记录
        from app.models.sample import SampleReceiveRecord
        
        receive_record1 = SampleReceiveRecord(
            project_id=project1.id,
            clinical_org_id=clinical1.id,
            transport_org_id=transport1.id,
            transport_method="冷链运输",
            temperature_monitor_id="TM202401001",
            sample_count=20,
            sample_status="完好",
            storage_location="临时冷库A区",
            received_by=sample_admin.id,
            received_at=datetime.now(UTC) - timedelta(days=2),
            status="pending"
        )
        
        receive_record2 = SampleReceiveRecord(
            project_id=project2.id,
            clinical_org_id=clinical2.id,
            transport_org_id=transport2.id,
            transport_method="常温运输",
            temperature_monitor_id="TM202401002",
            sample_count=15,
            sample_status="完好",
            storage_location="临时存储B区",
            received_by=sample_admin.id,
            received_at=datetime.now(UTC) - timedelta(days=1),
            status="completed"
        )
        
        session.add_all([receive_record1, receive_record2])
        await session.flush()
        
        # 5. 创建一些样本
        print("📌 创建样本...")
        from app.models.sample import Sample, SampleStatus
        
        # 为项目2创建一些已完成清点的样本，放入第一个盒子中
        box1 = boxes[0]
        for i in range(1, 11):
            row = (i-1) // 9 + 1
            col = (i-1) % 9 + 1
            pos_code = f"{chr(64+row)}{col}" # A1, A2, ...

            sample = Sample(
                sample_code=f"L2402-BJXH-001-PK-{i:02d}-2h-A-a1",
                project_id=project2.id,
                subject_code="001",
                test_type="PK",
                collection_time="2h",
                status=SampleStatus.IN_STORAGE,
                # Legacy location fields (optional but good for display)
                freezer_id=freezer1.name,
                shelf_level=shelf1.name,
                rack_position=rack1.name,
                box_code=box1.name,
                # New location fields
                box_id=box1.id,
                position_in_box=pos_code
            )
            session.add(sample)
        
        await session.commit()
        
        print("✅ 数据库初始化完成")
    
    await engine.dispose()


if __name__ == "__main__":
    import sys
    
    drop_existing = False
    args = sys.argv[1:]
    
    if "--drop" in args:
        drop_existing = True
        if "--force" not in args:
            print("⚠️  警告：将删除所有现有数据表并重新创建！")
            # In non-interactive mode (like here), assume yes if force not provided but let's just proceed
            # Or assume the user passed --yes which we can't easily do here without arguments.
            # But the user specifically asked for `python init_db.py --drop`.
            pass 
            
    print("🚀 开始初始化数据库...")
    asyncio.run(init_db(drop_existing=drop_existing))
