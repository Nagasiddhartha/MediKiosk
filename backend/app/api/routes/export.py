from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.allergy import Allergy
from app.models.body_map_annotation import BodyMapAnnotation
from app.models.chronic_condition import ChronicCondition
from app.models.csv_import_batch import CSVImportBatch
from app.models.document import Document
from app.models.document_ocr_output import DocumentOcrOutput
from app.models.extracted_field import ExtractedField
from app.models.health_reading import HealthReading
from app.models.medication import Medication
from app.models.patient_profile import PatientProfile
from app.models.red_flag_event import RedFlagEvent
from app.models.symptom_encounter import SymptomEncounter
from app.models.user import User
from app.models.visit import Visit
from app.services.fhir_exporter import generate_fhir_bundle


router = APIRouter()


@router.get("/json")
def export_account_json(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.scalar(
        select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    )

    conditions = db.scalars(
        select(ChronicCondition).where(ChronicCondition.user_id == current_user.id)
    ).all()

    allergies = db.scalars(
        select(Allergy).where(Allergy.user_id == current_user.id)
    ).all()

    medications = db.scalars(
        select(Medication).where(Medication.user_id == current_user.id)
    ).all()

    visits = db.scalars(
        select(Visit).where(Visit.user_id == current_user.id)
    ).all()

    symptom_encounters = db.scalars(
        select(SymptomEncounter).where(SymptomEncounter.user_id == current_user.id)
    ).all()

    encounter_ids = [item.id for item in symptom_encounters]

    body_map_annotations = []

    if encounter_ids:
        body_map_annotations = db.scalars(
            select(BodyMapAnnotation).where(
                BodyMapAnnotation.encounter_id.in_(encounter_ids)
            )
        ).all()

    health_readings = db.scalars(
        select(HealthReading).where(HealthReading.user_id == current_user.id)
    ).all()

    import_batches = db.scalars(
        select(CSVImportBatch).where(CSVImportBatch.user_id == current_user.id)
    ).all()

    red_flag_events = db.scalars(
        select(RedFlagEvent).where(RedFlagEvent.user_id == current_user.id)
    ).all()

    documents = db.scalars(
        select(Document).where(Document.user_id == current_user.id)
    ).all()

    document_ids = [item.id for item in documents]

    document_ocr_outputs = []
    extracted_fields = []

    if document_ids:
        document_ocr_outputs = db.scalars(
            select(DocumentOcrOutput).where(
                DocumentOcrOutput.document_id.in_(document_ids)
            )
        ).all()

        extracted_fields = db.scalars(
            select(ExtractedField).where(
                ExtractedField.document_id.in_(document_ids)
            )
        ).all()

    documents_safe = []

    for document in documents:
        documents_safe.append({
            "id": document.id,
            "title": document.title,
            "document_type": document.document_type,
            "original_filename": document.original_filename,
            "mime_type": document.mime_type,
            "file_size_bytes": document.file_size_bytes,
            "file_hash": document.file_hash,
            "status": document.status,
            "overall_confidence": document.overall_confidence,
            "confidence_tier": document.confidence_tier,
            "failure_reason": document.failure_reason,
            "confirmed_at": document.confirmed_at,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
        })

    payload = {
        "exported_at": datetime.now(timezone.utc),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at,
        },
        "patient_profile": profile,
        "chronic_conditions": conditions,
        "allergies": allergies,
        "medications": medications,
        "visits": visits,
        "symptom_encounters": symptom_encounters,
        "body_map_annotations": body_map_annotations,
        "health_readings": health_readings,
        "csv_import_batches": import_batches,
        "red_flag_events": red_flag_events,
        "documents": documents_safe,
        "document_ocr_outputs": document_ocr_outputs,
        "extracted_fields": extracted_fields,
    }

    return JSONResponse(content=jsonable_encoder(payload))


@router.get("/fhir")
def export_account_fhir(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bundle = generate_fhir_bundle(
        user_id=current_user.id,
        db=db,
    )
    return JSONResponse(
        content=bundle,
        media_type="application/fhir+json",
        headers={
            "Content-Disposition": f"attachment; filename=medikiosk-fhir-{current_user.id}.json"
        },
    )


@router.delete(
    "/account",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)