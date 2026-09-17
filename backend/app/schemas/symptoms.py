from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BodyMapAnnotationCreate(BaseModel):
    body_region: str
    sub_region: str | None = None
    laterality: str | None = None
    surface: str | None = None
    pain_type: str | None = None
    severity: str | None = None
    svg_element_id: str | None = None


class BodyMapAnnotationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    encounter_id: UUID
    body_region: str
    sub_region: str | None
    laterality: str | None
    surface: str | None
    pain_type: str | None
    severity: str | None
    svg_element_id: str | None
    created_at: datetime


class SymptomEncounterCreate(BaseModel):
    chief_complaint: str | None = None
    raw_input: str | None = None
    structured_data: dict[str, Any] | None = None
    duration: str | None = None
    severity: str | None = None


class SymptomEncounterUpdate(BaseModel):
    chief_complaint: str | None = None
    raw_input: str | None = None
    structured_data: dict[str, Any] | None = None
    duration: str | None = None
    severity: str | None = None
    status: str | None = None


from pydantic import BaseModel, ConfigDict, computed_field

class SymptomEncounterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    chief_complaint: str | None
    raw_input: str | None
    structured_data: dict[str, Any] | None
    duration: str | None
    severity: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    annotations: list[BodyMapAnnotationRead] = []

    @computed_field
    @property
    def body_annotations(self) -> list[BodyMapAnnotationRead]:
        return self.annotations