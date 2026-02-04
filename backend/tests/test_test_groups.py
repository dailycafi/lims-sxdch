"""
Tests for test group endpoints.
Feature 1: Copy with override data functionality.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_group import TestGroup
from app.models.project import Project
from app.models.user import User


class TestTestGroupCopy:
    """Tests for copying test groups with override data."""

    @pytest.mark.asyncio
    async def test_copy_test_group_basic(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_group: TestGroup,
    ):
        """Test basic copy without override data preserves source values."""
        response = await client.post(
            "/api/v1/test-groups/copy",
            json={"source_id": test_group.id},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify copy preserves source data
        assert data["name"] == test_group.name
        assert data["cycle"] == test_group.cycle
        assert data["dosage"] == test_group.dosage
        assert data["planned_count"] == test_group.planned_count
        assert data["backup_count"] == test_group.backup_count
        assert data["subject_prefix"] == test_group.subject_prefix
        assert data["subject_start_number"] == test_group.subject_start_number

        # Verify copy is unlocked
        assert data["is_confirmed"] is False
        assert data["confirmed_at"] is None
        assert data["confirmed_by"] is None

        # Verify it's a new record
        assert data["id"] != test_group.id

    @pytest.mark.asyncio
    async def test_copy_test_group_with_name_override(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_group: TestGroup,
    ):
        """Test copy with name override."""
        new_name = "Copied Group - New Name"
        response = await client.post(
            "/api/v1/test-groups/copy",
            json={
                "source_id": test_group.id,
                "name": new_name,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify name is overridden
        assert data["name"] == new_name

        # Verify other fields preserved
        assert data["cycle"] == test_group.cycle
        assert data["dosage"] == test_group.dosage

    @pytest.mark.asyncio
    async def test_copy_test_group_with_multiple_overrides(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_group: TestGroup,
    ):
        """Test copy with multiple field overrides."""
        override_data = {
            "source_id": test_group.id,
            "name": "Completely New Group",
            "cycle": "P2",
            "dosage": "200mg",
            "planned_count": 10,
            "backup_count": 3,
            "subject_prefix": "N",
            "subject_start_number": 100,
        }

        response = await client.post(
            "/api/v1/test-groups/copy",
            json=override_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all overrides applied
        assert data["name"] == override_data["name"]
        assert data["cycle"] == override_data["cycle"]
        assert data["dosage"] == override_data["dosage"]
        assert data["planned_count"] == override_data["planned_count"]
        assert data["backup_count"] == override_data["backup_count"]
        assert data["subject_prefix"] == override_data["subject_prefix"]
        assert data["subject_start_number"] == override_data["subject_start_number"]

        # Still unlocked
        assert data["is_confirmed"] is False

    @pytest.mark.asyncio
    async def test_copy_test_group_with_detection_configs_override(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_group: TestGroup,
    ):
        """Test copy with detection_configs override."""
        new_detection_configs = [
            {
                "test_type": "ADA",
                "sample_type": "Serum",
                "primary_sets": 3,
                "backup_sets": 2,
                "collection_points": [
                    {"code": "A1", "name": "Pre-dose"},
                    {"code": "A2", "name": "Post-dose"},
                ],
            }
        ]

        response = await client.post(
            "/api/v1/test-groups/copy",
            json={
                "source_id": test_group.id,
                "detection_configs": new_detection_configs,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify detection_configs overridden
        assert len(data["detection_configs"]) == 1
        assert data["detection_configs"][0]["test_type"] == "ADA"
        assert data["detection_configs"][0]["sample_type"] == "Serum"
        assert data["detection_configs"][0]["primary_sets"] == 3

    @pytest.mark.asyncio
    async def test_copy_confirmed_group_creates_unlocked_copy(
        self,
        client: AsyncClient,
        auth_headers: dict,
        confirmed_test_group: TestGroup,
    ):
        """Test that copying a confirmed group creates an unlocked copy."""
        response = await client.post(
            "/api/v1/test-groups/copy",
            json={"source_id": confirmed_test_group.id},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Source was confirmed
        assert confirmed_test_group.is_confirmed is True

        # Copy should be unlocked
        assert data["is_confirmed"] is False
        assert data["confirmed_at"] is None
        assert data["confirmed_by"] is None

    @pytest.mark.asyncio
    async def test_copy_nonexistent_group_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test copying non-existent group returns 404."""
        response = await client.post(
            "/api/v1/test-groups/copy",
            json={"source_id": 99999},
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_copy_requires_authentication(
        self,
        client: AsyncClient,
        test_group: TestGroup,
    ):
        """Test that copy endpoint requires authentication."""
        response = await client.post(
            "/api/v1/test-groups/copy",
            json={"source_id": test_group.id},
        )

        assert response.status_code == 401


class TestTestGroupCRUD:
    """Basic CRUD tests for test groups."""

    @pytest.mark.asyncio
    async def test_get_test_groups_by_project(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
        test_group: TestGroup,
    ):
        """Test getting test groups for a project."""
        response = await client.get(
            f"/api/v1/projects/{test_project.id}/test-groups",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) >= 1

        # Find our test group
        found = next((g for g in data if g["id"] == test_group.id), None)
        assert found is not None
        assert found["name"] == test_group.name

    @pytest.mark.asyncio
    async def test_get_single_test_group(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_group: TestGroup,
    ):
        """Test getting a single test group by ID."""
        response = await client.get(
            f"/api/v1/test-groups/{test_group.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == test_group.id
        assert data["name"] == test_group.name
        assert data["cycle"] == test_group.cycle

    @pytest.mark.asyncio
    async def test_create_test_group(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
    ):
        """Test creating a new test group."""
        new_group_data = {
            "project_id": test_project.id,
            "name": "New Test Group",
            "cycle": "P1",
            "dosage": "50mg",
            "planned_count": 8,
            "backup_count": 2,
            "subject_prefix": "T",
            "subject_start_number": 1,
            "detection_configs": [
                {
                    "test_type": "PK",
                    "sample_type": "Plasma",
                    "primary_sets": 2,
                    "backup_sets": 1,
                    "collection_points": [
                        {"code": "C1", "name": "0h"},
                    ],
                }
            ],
        }

        response = await client.post(
            "/api/v1/test-groups",
            json=new_group_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == new_group_data["name"]
        assert data["cycle"] == new_group_data["cycle"]
        assert data["dosage"] == new_group_data["dosage"]
        assert data["planned_count"] == new_group_data["planned_count"]
        assert data["is_confirmed"] is False

    @pytest.mark.asyncio
    async def test_update_test_group(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_group: TestGroup,
    ):
        """Test updating an unlocked test group."""
        update_data = {
            "name": "Updated Group Name",
            "dosage": "150mg",
        }

        response = await client.put(
            f"/api/v1/test-groups/{test_group.id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == update_data["name"]
        assert data["dosage"] == update_data["dosage"]

    @pytest.mark.asyncio
    async def test_cannot_update_confirmed_group(
        self,
        client: AsyncClient,
        auth_headers: dict,
        confirmed_test_group: TestGroup,
    ):
        """Test that confirmed groups cannot be updated."""
        update_data = {
            "name": "Should Not Update",
        }

        response = await client.put(
            f"/api/v1/test-groups/{confirmed_test_group.id}",
            json=update_data,
            headers=auth_headers,
        )

        # Should return error for confirmed group
        assert response.status_code in [400, 403]
