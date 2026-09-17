import os
from pathlib import Path
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.document import Document
from app.models.document_ocr_output import DocumentOcrOutput
from app.models.extracted_field import ExtractedField
from app.models.user import User
from app.schemas.documents import (
    DocumentDetail,
    DocumentOcrRead,
    DocumentRead,
    ExtractedFieldRead,
    FieldReviewUpdate,
)
from app.services.audit import log_audit
from app.services.document_pipeline import process_document
from app.services.storage import allowed_filename, store_upload


router = APIRouter()


def get_document_or_404(
    document_id: UUID,
    user_id: UUID,
    db: Session,
) -> Document:
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user_id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document


def get_document_detail(
    document_id: UUID,
    user_id: UUID,
    db: Session,
) -> DocumentDetail:
    document = get_document_or_404(document_id, user_id, db)

    ocr = db.scalar(
        select(DocumentOcrOutput)
        .where(DocumentOcrOutput.document_id == document.id)
        .order_by(DocumentOcrOutput.created_at.desc())
        .limit(1)
    )

    fields = db.scalars(
        select(ExtractedField)
        .where(ExtractedField.document_id == document.id)
        .order_by(ExtractedField.created_at.asc())
    ).all()

    return DocumentDetail(
        document=DocumentRead.model_validate(document),
        ocr=DocumentOcrRead.model_validate(ocr) if ocr else None,
        fields=[ExtractedFieldRead.model_validate(field) for field in fields],
    )


@router.get(
    "",
    response_model=list[DocumentRead],
)
def list_documents(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    documents = db.scalars(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return documents


@router.post(
    "/upload",
    response_model=DocumentDetail,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required",
        )

    if not allowed_filename(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed file types: png, jpg, jpeg, webp, tiff, tif, pdf, txt",
        )

    content = await file.read()

    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File is too large",
        )

    stored_path, file_hash, extension = store_upload(
        user_id=current_user.id,
        filename=file.filename,
        content=content,
    )

    document = Document(
        user_id=current_user.id,
        title=title or file.filename,
        document_type=document_type,
        original_filename=file.filename,
        stored_path=stored_path,
        file_hash=file_hash,
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(content),
        status="uploaded",
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    process_document(document.id, db)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="document_uploaded",
        entity_type="document",
        entity_id=document.id,
        details={"filename": file.filename, "size": len(content)},
    )

    return get_document_detail(document.id, current_user.id, db)


@router.get(
    "/{document_id}",
    response_model=DocumentDetail,
)
def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_document_detail(document_id, current_user.id, db)


@router.get("/{document_id}/file")
def get_document_file(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = get_document_or_404(document_id, current_user.id, db)

    file_path = Path(document.stored_path).resolve()
    storage_root = Path(settings.storage_root).resolve()

    # Prevent path traversal
    try:
        file_path.relative_to(storage_root)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this file path is forbidden",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on disk",
        )

    media_type = document.mime_type or "application/octet-stream"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=document.original_filename or f"document_{document.id}",
    )


@router.post(
    "/{document_id}/reprocess",
    response_model=DocumentDetail,
)
def reprocess_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = get_document_or_404(document_id, current_user.id, db)

    if document.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Confirmed documents cannot be reprocessed",
        )

    process_document(document.id, db)

    return get_document_detail(document.id, current_user.id, db)


@router.post(
    "/{document_id}/confirm",
    response_model=DocumentDetail,
)
def confirm_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = get_document_or_404(document_id, current_user.id, db)

    if document.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already confirmed",
        )

    if document.status == "unusable":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unusable documents cannot be confirmed",
        )

    pending_count = db.scalar(
        select(func.count())
        .select_from(ExtractedField)
        .where(
            ExtractedField.document_id == document.id,
            ExtractedField.status == "pending_review",
        )
    )

    if pending_count and pending_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All extracted fields must be reviewed before confirming the document",
        )

    document.status = "confirmed"
    document.confirmed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(document)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="document_confirmed",
        entity_type="document",
        entity_id=document.id,
        details={"title": document.title},
    )

    return get_document_detail(document.id, current_user.id, db)


@router.put(
    "/fields/{field_id}",
    response_model=ExtractedFieldRead,
)
def review_field(
    field_id: UUID,
    payload: FieldReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    field = db.scalar(
        select(ExtractedField)
        .join(Document, Document.id == ExtractedField.document_id)
        .where(
            ExtractedField.id == field_id,
            Document.user_id == current_user.id,
        )
    )

    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Extracted field not found",
        )

    if field.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Field has already been reviewed",
        )

    if payload.action == "accept":
        field.status = "accepted"

    elif payload.action == "correct":
        if not payload.user_corrected_value or not payload.user_corrected_value.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_corrected_value is required when action is correct",
            )

        field.status = "corrected"
        field.user_corrected_value = payload.user_corrected_value.strip()
        field.final_confidence = 1.0
        field.confidence_tier = "tier1"

        normalized = dict(field.normalized_value or {})
        normalized["user_corrected"] = True
        normalized["user_value"] = field.user_corrected_value
        field.normalized_value = normalized

    elif payload.action == "reject":
        field.status = "rejected"
        field.final_confidence = 0.0
        field.confidence_tier = "tier4"

    field.review_reason = payload.review_reason
    field.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(field)

    log_audit(
        db=db,
        user_id=current_user.id,
        action=f"field_{payload.action}",
        entity_type="extracted_field",
        entity_id=field.id,
        details={
            "field_name": field.field_name,
            "action": payload.action,
            "document_id": str(field.document_id),
        },
    )

    return field