from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TimelineEventRead(BaseModel):
    event_type: str
    event_date: datetime
    title: str
    summary: str | None = None
    entity_id: UUID | None = None
    source: str | None = None
    trust_status: str | None = None


class GroupedTimelinePeriod(BaseModel):
    period: str
    year: int
    month: int
    events: list[TimelineEventRead]


class TimelineResponse(BaseModel):
    total_events: int
    events: list[TimelineEventRead] = []
    groups: list[GroupedTimelinePeriod] = []