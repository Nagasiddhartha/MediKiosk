from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IntakeProcessRequest(BaseModel):
    encounter_id: UUID | None = None
    text: str = Field(min_length=1)


class IntakeVoiceRequest(BaseModel):
    encounter_id: UUID | None = None
    transcript: str = Field(min_length=1)


class IntakeRedFlag(BaseModel):
    rule_id: str
    severity: str
    message: str


class IntakeProcessResponse(BaseModel):
    encounter_id: UUID
    status: str
    urgent: bool
    structured: dict[str, Any]
    next_questions: list[str]
    red_flags: list[IntakeRedFlag]


class IntakeMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    encounter_id: UUID
    role: str
    content: str
    structured_payload: dict[str, Any] | None = None
    created_at: datetime


class IntakeEncounterListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chief_complaint: str | None
    duration: str | None
    severity: str | None
    status: str
    message_count: int = 0
    annotations_count: int = 0
    created_at: datetime
    updated_at: datetime