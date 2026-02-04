"""
Test fixtures for LIMS backend tests.
Uses PostgreSQL for integration tests.
"""
import os
import asyncio
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text

# Set test environment variables before importing app modules
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://cafi@localhost:5432/lims_test"
)
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only-do-not-use-in-production"
os.environ["DEBUG"] = "true"

from app.core.database import Base, get_db
from app.core.security import pwd_context, create_access_token
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.test_group import TestGroup
from app.main import app


# Create test engine with NullPool to avoid connection issues in tests
TEST_DATABASE_URL = os.environ["DATABASE_URL"]
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def setup_database():
    """
    Create all tables once at the start of the test session.
    Drop all tables at the end.
    """
    async with test_engine.begin() as conn:
        # Drop all tables first (with CASCADE to handle foreign keys)
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))


@pytest_asyncio.fixture(scope="function")
async def db_session(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """
    Create a fresh database session for each test.
    Uses SAVEPOINT for nested transaction isolation.
    """
    # Start a connection and transaction
    connection = await test_engine.connect()
    transaction = await connection.begin()

    # Create session bound to the connection
    session = AsyncSession(bind=connection, expire_on_commit=False)

    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async HTTP client for testing API endpoints.
    Overrides the database dependency to use the test session.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user with sample_admin role."""
    user = User(
        username="testuser",
        email="testuser@example.com",
        full_name="Test User",
        hashed_password=pwd_context.hash("testpassword123"),
        role=UserRole.SAMPLE_ADMIN,
        is_active=True,
        is_superuser=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create a test admin user with system_admin role."""
    user = User(
        username="adminuser",
        email="admin@example.com",
        full_name="Admin User",
        hashed_password=pwd_context.hash("adminpassword123"),
        role=UserRole.SYSTEM_ADMIN,
        is_active=True,
        is_superuser=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    """Create authentication headers with a valid JWT token."""
    token = create_access_token(data={"sub": test_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_auth_headers(admin_user: User) -> dict:
    """Create authentication headers for admin user."""
    token = create_access_token(data={"sub": admin_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_project(db_session: AsyncSession, test_user: User) -> Project:
    """Create a test project with sample code rule configured."""
    project = Project(
        sponsor_project_code="SPONSOR-001",
        lab_project_code="LAB-001",
        sample_code_rule={
            "elements": ["lab_code", "subject_id", "test_type", "sample_seq", "sample_type"],
            "order": {"lab_code": 0, "subject_id": 1, "test_type": 2, "sample_seq": 3, "sample_type": 4},
            "slots": [
                {"elementId": "lab_code", "separator": "-"},
                {"elementId": "subject_id", "separator": "-"},
                {"elementId": "test_type", "separator": "-"},
                {"elementId": "sample_seq", "separator": "-"},
                {"elementId": "sample_type", "separator": ""},
            ],
            "dictionaries": {
                "cycles": ["P1", "P2"],
                "test_types": ["PK", "ADA"],
                "primary_types": ["a", "b"],
                "backup_types": ["B1", "B2"],
                "clinic_codes": ["01", "02"],
            },
        },
        is_active=True,
        is_archived=False,
        created_by=test_user.id,
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest_asyncio.fixture
async def test_group(db_session: AsyncSession, test_project: Project) -> TestGroup:
    """Create a test group (unlocked)."""
    group = TestGroup(
        project_id=test_project.id,
        name="Test Group 1",
        cycle="P1",
        dosage="100mg",
        planned_count=5,
        backup_count=2,
        subject_prefix="S",
        subject_start_number=1,
        detection_configs=[
            {
                "test_type": "PK",
                "sample_type": "Plasma",
                "primary_sets": 2,
                "backup_sets": 1,
                "collection_points": [
                    {"code": "C1", "name": "0h"},
                    {"code": "C2", "name": "1h"},
                    {"code": "C3", "name": "2h"},
                ],
            }
        ],
        collection_points=[
            {"code": "C1", "name": "0h"},
            {"code": "C2", "name": "1h"},
        ],
        is_confirmed=False,
        is_active=True,
        display_order=0,
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)
    return group


@pytest_asyncio.fixture
async def confirmed_test_group(db_session: AsyncSession, test_project: Project, test_user: User) -> TestGroup:
    """Create a confirmed (locked) test group."""
    from datetime import datetime, timezone

    group = TestGroup(
        project_id=test_project.id,
        name="Confirmed Group",
        cycle="P1",
        dosage="200mg",
        planned_count=3,
        backup_count=1,
        subject_prefix="R",
        subject_start_number=1,
        detection_configs=[
            {
                "test_type": "PK",
                "sample_type": "Plasma",
                "primary_sets": 2,
                "backup_sets": 1,
                "collection_points": [
                    {"code": "C1", "name": "0h"},
                    {"code": "C2", "name": "1h"},
                ],
            },
            {
                "test_type": "ADA",
                "sample_type": "Serum",
                "primary_sets": 1,
                "backup_sets": 1,
                "collection_points": [
                    {"code": "A1", "name": "Pre-dose"},
                ],
            },
        ],
        is_confirmed=True,
        confirmed_at=datetime.now(timezone.utc),
        confirmed_by=test_user.id,
        is_active=True,
        display_order=1,
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)
    return group
