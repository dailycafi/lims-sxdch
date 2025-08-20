import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import Base
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import *  # 导入所有模型
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import random


async def drop_all_tables(engine):
    """删除所有表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("⚠️  已删除所有数据表")


async def init_db(drop_existing=False):
    """初始化数据库"""
    # 创建引擎
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    if drop_existing:
        await drop_all_tables(engine)
    
    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 创建所有数据表成功")
    
    # 创建会话
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 1. 创建组织机构
        print("📌 创建组织机构...")
        from app.models.global_params import Organization
        
        # 申办者
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
        
        # 2. 创建用户
        print("📌 创建用户...")
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
        
        # 样本管理员
        sample_admin = User(
            username="sample_admin",
            email="sample@lims.com",
            full_name="样本管理员",
            hashed_password=get_password_hash("sample123"),
            role=UserRole.SAMPLE_ADMIN
        )
        
        # 项目负责人
        project_lead = User(
            username="project_lead",
            email="project@lims.com",
            full_name="项目负责人",
            hashed_password=get_password_hash("project123"),
            role=UserRole.PROJECT_LEAD
        )
        
        # 分析测试主管
        test_manager = User(
            username="test_manager",
            email="test@lims.com",
            full_name="分析测试主管",
            hashed_password=get_password_hash("test123"),
            role=UserRole.TEST_MANAGER
        )
        
        # 研究室主任
        lab_director = User(
            username="lab_director",
            email="director@lims.com",
            full_name="研究室主任",
            hashed_password=get_password_hash("director123"),
            role=UserRole.LAB_DIRECTOR
        )
        
        # 分析员
        analyst = User(
            username="analyst",
            email="analyst@lims.com",
            full_name="分析员",
            hashed_password=get_password_hash("analyst123"),
            role=UserRole.ANALYST
        )
        
        session.add_all([admin_user, sample_admin, project_lead, test_manager, lab_director, analyst])
        await session.flush()
        
        # 3. 创建项目
        print("📌 创建项目...")
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
        
        # 4. 创建样本接收记录
        print("📌 创建样本接收记录...")
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
            received_at=datetime.utcnow() - timedelta(days=2),
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
            received_at=datetime.utcnow() - timedelta(days=1),
            status="completed"
        )
        
        session.add_all([receive_record1, receive_record2])
        await session.flush()
        
        # 5. 创建一些样本
        print("📌 创建样本...")
        from app.models.sample import Sample, SampleStatus
        
        # 为项目2创建一些已完成清点的样本
        for i in range(1, 11):
            sample = Sample(
                sample_code=f"L2402-BJXH-001-PK-{i:02d}-2h-A-a1",
                project_id=project2.id,
                subject_code="001",
                test_type="PK",
                collection_time="2h",
                status=SampleStatus.IN_STORAGE,
                freezer_id="F01",
                shelf_level="3",
                rack_position="A2",
                box_code=f"BOX-2024-{(i-1)//5 + 1:03d}",
                position_in_box=f"{chr(65 + (i-1)//8)}{(i-1)%8 + 1}"
            )
            session.add(sample)
        
        await session.commit()
        
        print("\n✅ 数据库初始化完成!")
        print("\n📌 创建的用户账号:")
        print("  - 系统管理员: admin / admin123")
        print("  - 样本管理员: sample_admin / sample123")
        print("  - 项目负责人: project_lead / project123")
        print("  - 分析测试主管: test_manager / test123")
        print("  - 研究室主任: lab_director / director123")
        print("  - 分析员: analyst / analyst123")
        print("\n📌 创建的示例数据:")
        print("  - 2个组织机构（申办者、临床机构、运输公司）")
        print("  - 2个项目")
        print("  - 2条样本接收记录")
        print("  - 10个样本（已入库）")
    
    await engine.dispose()


if __name__ == "__main__":
    import sys
    
    drop_existing = False
    if len(sys.argv) > 1 and sys.argv[1] == "--drop":
        drop_existing = True
        print("⚠️  警告：将删除所有现有数据表并重新创建！")
        confirm = input("确认操作？(yes/no): ")
        if confirm.lower() != "yes":
            print("操作已取消")
            sys.exit(0)
    
    print("🚀 开始初始化数据库...")
    asyncio.run(init_db(drop_existing=drop_existing))
