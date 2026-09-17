from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ExtractedFieldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    entity_type: str
    field_name: str
    raw_value: str | None
    normalized_value: dict[str, Any] | None
    unit: str | None
    ocr_confidence: float | None
    llm_confidence: float | None
    final_confidence: float | None
    confidence_tier: str | None
    status: str
    user_corrected_value: str | None
    review_reason: str | None
    created_at: datetime
    reviewed_at: datetime | None


class DocumentOcrRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    raw_text: str | None
    cleaned_text: str | None
    ocr_engine: str | None
    language: str | None
    mean_word_confidence: float | None
    page_count: int | None
    preprocessing_metadata: dict[str, Any] | None
    created_at: datetime


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str | None
    document_type: str | None
    original_filename: str | None
    mime_type: str | None
    file_size_bytes: int | None
    status: str
    overall_confidence: float | None
    confidence_tier: str | None
    failure_reason: str | None
    confirmed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DocumentDetail(BaseModel):
    document: DocumentRead
    ocr: DocumentOcrRead | None = None
    fields: list[ExtractedFieldRead] = []


class FieldReviewUpdate(BaseModel):
    action: Literal["accept", "correct", "reject"]
    user_corrected_value: str | None = None
    review_reason: str | None = None