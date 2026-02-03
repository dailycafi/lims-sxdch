"""
Tests for project generate-all-sample-codes endpoint.
Feature 2: Generate sample codes directly from project list/detail.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.test_group import TestGroup
from app.models.user import User


class TestGenerateAllSampleCodes:
    """Tests for the generate-all-sample-codes endpoint."""

    @pytest.mark.asyncio
    async def test_generate_all_sample_codes_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
        confirmed_test_group: TestGroup,
    ):
        """Test generating sample codes for a project with confirmed groups."""
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "sample_codes" in data
        assert "total_count" in data
        assert "groups_processed" in data
        assert "summary" in data

        # Should have generated codes
        assert data["total_count"] > 0
        assert isinstance(data["sample_codes"], list)
        assert data["groups_processed"] >= 1

    @pytest.mark.asyncio
    async def test_generate_returns_unique_codes(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
        confirmed_test_group: TestGroup,
    ):
        """Test that generated sample codes are unique."""
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        codes = data["sample_codes"]
        # All codes should be unique
        assert len(codes) == len(set(codes))

    @pytest.mark.asyncio
    async def test_generate_no_confirmed_groups(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
        test_group: TestGroup,  # This is unconfirmed
    ):
        """Test generating codes when no confirmed groups exist."""
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        # Should still succeed but with 0 codes
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] == 0
        assert data["groups_processed"] == 0
        assert len(data["sample_codes"]) == 0

    @pytest.mark.asyncio
    async def test_generate_nonexistent_project_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test generating codes for non-existent project returns 404."""
        response = await client.post(
            "/api/v1/projects/99999/generate-all-sample-codes",
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_generate_requires_authentication(
        self,
        client: AsyncClient,
        test_project: Project,
    ):
        """Test that endpoint requires authentication."""
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_generate_summary_contains_group_info(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
        confirmed_test_group: TestGroup,
    ):
        """Test that summary contains information about processed groups."""
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Summary should contain group details
        summary = data["summary"]
        assert isinstance(summary, list)

        if len(summary) > 0:
            group_summary = summary[0]
            assert "group_id" in group_summary or "group_name" in group_summary
            assert "codes_generated" in group_summary


class TestGenerateWithMultipleGroups:
    """Tests for generating codes with multiple confirmed groups."""

    @pytest.mark.asyncio
    async def test_generate_multiple_groups(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        test_project: Project,
        test_user: User,
    ):
        """Test generating codes from multiple confirmed groups."""
        from datetime import datetime, timezone

        # Create two confirmed groups
        group1 = TestGroup(
            project_id=test_project.id,
            name="Group 1",
            cycle="P1",
            dosage="100mg",
            planned_count=3,
            backup_count=1,
            subject_prefix="A",
            subject_start_number=1,
            detection_configs=[
                {
                    "test_type": "PK",
                    "sample_type": "Plasma",
                    "primary_sets": 1,
                    "backup_sets": 1,
                    "collection_points": [{"code": "C1", "name": "0h"}],
                }
            ],
            is_confirmed=True,
            confirmed_at=datetime.now(timezone.utc),
            confirmed_by=test_user.id,
            is_active=True,
            display_order=0,
        )

        group2 = TestGroup(
            project_id=test_project.id,
            name="Group 2",
            cycle="P2",
            dosage="200mg",
            planned_count=2,
            backup_count=1,
            subject_prefix="B",
            subject_start_number=1,
            detection_configs=[
                {
                    "test_type": "ADA",
                    "sample_type": "Serum",
                    "primary_sets": 1,
                    "backup_sets": 1,
                    "collection_points": [{"code": "A1", "name": "Pre-dose"}],
                }
            ],
            is_confirmed=True,
            confirmed_at=datetime.now(timezone.utc),
            confirmed_by=test_user.id,
            is_active=True,
            display_order=1,
        )

        db_session.add(group1)
        db_session.add(group2)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should have processed both groups
        assert data["groups_processed"] == 2

        # Total codes should be sum from both groups
        assert data["total_count"] > 0


class TestProjectEndpoints:
    """Basic tests for project endpoints."""

    @pytest.mark.asyncio
    async def test_get_project(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
    ):
        """Test getting a single project."""
        response = await client.get(
            f"/api/v1/projects/{test_project.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == test_project.id
        assert data["sponsor_project_code"] == test_project.sponsor_project_code
        assert data["lab_project_code"] == test_project.lab_project_code

    @pytest.mark.asyncio
    async def test_list_projects(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
    ):
        """Test listing projects."""
        response = await client.get(
            "/api/v1/projects",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Response could be list or paginated object
        if isinstance(data, list):
            assert len(data) >= 1
        else:
            assert "items" in data or "data" in data

    @pytest.mark.asyncio
    async def test_project_has_sample_code_rule(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
    ):
        """Test that project has sample_code_rule configured."""
        response = await client.get(
            f"/api/v1/projects/{test_project.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify sample_code_rule structure
        assert "sample_code_rule" in data
        rule = data["sample_code_rule"]

        assert "elements" in rule
        assert "slots" in rule
        assert "dictionaries" in rule
