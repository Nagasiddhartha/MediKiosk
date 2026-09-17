from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HealthReadingCreate(BaseModel):
    reading_type: str
    systolic: int | None = None
    diastolic: int | None = None
    numeric_value: float | None = None
    value_text: str | None = None
    unit: str | None = None
    recorded_at: datetime
    source: str | None = "manual"


class HealthReadingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    reading_type: str
    systolic: int | None
    diastolic: int | None
    numeric_value: float | None
    value_text: str | None
    unit: str | None
    recorded_at: datetime
    source: str | None
    import_batch_id: UUID | None
    created_at: datetime


class CSVImportResult(BaseModel):
    batch_id: UUID
    filename: str | None
    total_rows: int
    valid_rows: int
    invalid_rows: int
    errors: list[dict]