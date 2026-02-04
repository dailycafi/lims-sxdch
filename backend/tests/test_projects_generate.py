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

        # Verify response structure (matches actual API response)
        assert "sample_codes" in data
        assert "count" in data
        assert "message" in data
        assert "summary" in data

        # Should have generated codes
        assert data["count"] > 0
        assert isinstance(data["sample_codes"], list)
        assert len(data["sample_codes"]) == data["count"]

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
    async def test_generate_no_confirmed_groups_returns_400(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
        test_group: TestGroup,  # This is unconfirmed
    ):
        """Test generating codes when no confirmed groups exist returns 400."""
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        # API returns 400 when no confirmed groups
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

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
    async def test_generate_summary_contains_detection_info(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_project: Project,
        confirmed_test_group: TestGroup,
    ):
        """Test that summary contains detection configuration info."""
        response = await client.post(
            f"/api/v1/projects/{test_project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Summary should contain detection details
        summary = data["summary"]
        assert isinstance(summary, list)
        assert len(summary) > 0

        # Each summary item should have detection info
        for item in summary:
            assert "test_type" in item
            assert "generated_count" in item


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
            backup_subject_count=1,
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
            backup_subject_count=1,
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

        # Should have processed both groups (check summary length)
        assert len(data["summary"]) >= 2

        # Total codes should be sum from both groups
        assert data["count"] > 0


class TestProjectSampleCodeRule:
    """Tests for project sample code rule validation."""

    @pytest.mark.asyncio
    async def test_generate_fails_without_sample_code_rule(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Test generating codes fails when project has no sample code rule."""
        # Create project without sample_code_rule
        project = Project(
            sponsor_project_code="NO-RULE-001",
            lab_project_code="NR-001",
            sample_code_rule=None,  # No rule configured
            is_active=True,
            is_archived=False,
            created_by=test_user.id,
        )
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        response = await client.post(
            f"/api/v1/projects/{project.id}/generate-all-sample-codes",
            headers=auth_headers,
        )

        # Should return 400 with error message
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
