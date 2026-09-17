from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DashboardStats(BaseModel):
    active_conditions: int = 0
    active_medications: int = 0
    allergies_count: int = 0
    pending_documents: int = 0
    confirmed_documents: int = 0
    recent_red_flags: int = 0
    profile_completeness_percent: int = 0
    has_profile: bool = False
    is_summary_ready: bool = False


class LatestReadingSummary(BaseModel):
    id: UUID
    reading_type: str
    display_value: str
    unit: str | None = None
    recorded_at: datetime
    is_caution: bool = False


class LatestEncounterSummary(BaseModel):
    id: UUID
    chief_complaint: str | None = None
    duration: str | None = None
    severity: str | None = None
    status: str
    created_at: datetime


class DashboardOverviewResponse(BaseModel):
    stats: DashboardStats
    latest_reading: LatestReadingSummary | None = None
    latest_encounter: LatestEncounterSummary | None = None
    recent_timeline: list[dict[str, Any]] = []
    urgent_warning_active: bool = False
    urgent_warning_message: str | None = None
