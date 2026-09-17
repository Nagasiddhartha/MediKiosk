from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, Field


class RedThreadQueryRequest(BaseModel):
    current_complaint: str = Field(min_length=2)
    structured_data: dict[str, Any] | None = None
    body_region: str | None = None
    limit: int = Field(default=5, ge=1, le=20)


class RedThreadHistoricalEvent(BaseModel):
    event_type: str
    event_id: UUID
    event_date: datetime | None = None
    relevance_score: float
    content_summary: str
    cautious_explanation: str
    source_reference: str
    link_id: str | None = None


from pydantic import BaseModel, Field, computed_field


class RedThreadQueryResponse(BaseModel):
    current_complaint: str
    relevant_events_count: int
    insights: list[RedThreadHistoricalEvent]
    clinical_safety_note: str = (
        "These correlations highlight historical context for clinical review and do not imply causal relationships or diagnoses."
    )

    @computed_field
    @property
    def matches(self) -> list[RedThreadHistoricalEvent]:
        return self.insights

    @computed_field
    @property
    def disclaimer(self) -> str:
        return self.clinical_safety_note
