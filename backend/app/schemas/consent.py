from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class UserConsentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    consent_type: str
    status: str
    version: str
    updated_at: datetime


class ConsentUpdateRequest(BaseModel):
    consent_type: str  # ai_processing, ocr_processing, data_analytics, data_export
    granted: bool
