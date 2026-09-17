from typing import Any
from uuid import UUID

from pydantic import BaseModel


class RedFlagCheckRequest(BaseModel):
    chief_complaint: str | None = None
    structured_data: dict[str, Any] | None = None
    encounter_id: UUID | None = None


class RedFlagResult(BaseModel):
    rule_id: str
    severity: str
    message: str


class RedFlagCheckResponse(BaseModel):
    triggered: bool
    flags: list[RedFlagResult]