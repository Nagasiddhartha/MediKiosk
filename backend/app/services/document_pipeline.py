from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.consent import UserConsent
from app.models.document import Document
from app.models.document_ocr_output import DocumentOcrOutput
from app.models.extracted_field import ExtractedField
from app.services.audit import log_audit
from app.services.confidence import compute_parse_score, confidence_tier, field_confidence
from app.services.llm_extraction import extract_document_fields
from app.services.ocr import extract_ocr


def _text(value):
    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    return value


def process_document(document_id: UUID, db: Session) -> Document:
    document = db.get(Document, document_id)

    if document is None:
        raise ValueError("Document not found")

    document.status = "processing"
    document.failure_reason = None
    db.commit()

    stage = "ocr"

    try:
        db.execute(
            delete(DocumentOcrOutput).where(
                DocumentOcrOutput.document_id == document.id
            )
        )

        db.execute(
            delete(ExtractedField).where(
                ExtractedField.document_id == document.id
            )
        )

        db.commit()

        ocr_result = extract_ocr(
            document.stored_path or "",
            document.mime_type or "",
        )

        ocr_row = DocumentOcrOutput(
            document_id=document.id,
            raw_text=ocr_result["raw_text"],
            cleaned_text=ocr_result["cleaned_text"],
            ocr_engine=ocr_result["ocr_engine"],
            language=ocr_result["language"],
            mean_word_confidence=ocr_result["mean_word_confidence"],
            page_count=ocr_result["page_count"],
            preprocessing_metadata=ocr_result["preprocessing_metadata"],
        )

        db.add(ocr_row)
        db.flush()

        cleaned_text = ocr_result["cleaned_text"] or ""
        ocr_mean = ocr_result["mean_word_confidence"] or 0.0

        if not cleaned_text.strip():
            document.status = "unusable"
            document.overall_confidence = 0.0
            document.confidence_tier = "tier4"
            document.failure_reason = "No readable text found in document"
            db.commit()
            return document

        stage = "extraction"

        ai_consent = db.scalar(
            select(UserConsent).where(
                UserConsent.user_id == document.user_id,
                UserConsent.consent_type == "ai_processing",
            )
        )
        allow_ai = (ai_consent.status == "granted") if ai_consent else True

        extraction = extract_document_fields(cleaned_text, allow_ai=allow_ai)
        llm_confidence = extraction.get("confidence", 0.25)

        final_scores: list[float] = []

        def add_field(
            entity_type: str,
            field_name: str,
            raw_value: str | None,
            normalized_value: dict | None = None,
            unit: str | None = None,
        ):
            raw_value = _text(raw_value)

            if raw_value is None:
                return

            parse_score = compute_parse_score(
                field_name=field_name,
                raw_value=raw_value,
                normalized_value=normalized_value,
                unit=unit,
            )

            final = field_confidence(
                ocr_confidence=ocr_mean,
                llm_confidence=llm_confidence,
                parse_score=parse_score,
            )

            tier = confidence_tier(final)

            field = ExtractedField(
                document_id=document.id,
                entity_type=entity_type,
                field_name=field_name,
                raw_value=raw_value,
                normalized_value=normalized_value,
                unit=unit,
                ocr_confidence=ocr_mean,
                llm_confidence=llm_confidence,
                final_confidence=final,
                confidence_tier=tier,
                status="pending_review",
            )

            db.add(field)
            final_scores.append(final)

        add_field(
            entity_type="document",
            field_name="document_type",
            raw_value=extraction.get("document_type"),
            normalized_value={"source": "extraction"},
        )

        add_field(
            entity_type="document",
            field_name="document_date",
            raw_value=extraction.get("document_date"),
            normalized_value={"date": extraction.get("document_date")},
        )

        add_field(
            entity_type="document",
            field_name="provider_name",
            raw_value=extraction.get("provider_name"),
        )

        notes = _text(extraction.get("notes"))
        if notes:
            add_field(
                entity_type="document",
                field_name="notes",
                raw_value=notes[:2000],
            )

        medications = extraction.get("medications", [])

        for index, medication in enumerate(medications):
            if not isinstance(medication, dict):
                continue

            name = _text(medication.get("name")) or _text(medication.get("raw_text"))
            dosage = _text(medication.get("dosage"))
            frequency = _text(medication.get("frequency"))
            duration = _text(medication.get("duration"))
            route = _text(medication.get("route"))
            unit = _text(medication.get("unit"))
            raw_text = _text(medication.get("raw_text"))

            base_normalized = {
                "medication_index": index,
                "raw_text": raw_text,
            }

            add_field(
                entity_type="medication",
                field_name="medication_name",
                raw_value=name,
                normalized_value={
                    **base_normalized,
                    "dosage": dosage,
                    "frequency": frequency,
                    "duration": duration,
                    "route": route,
                },
            )

            add_field(
                entity_type="medication",
                field_name="medication_dosage",
                raw_value=dosage,
                normalized_value=base_normalized,
                unit=unit,
            )

            add_field(
                entity_type="medication",
                field_name="medication_frequency",
                raw_value=frequency,
                normalized_value=base_normalized,
            )

            add_field(
                entity_type="medication",
                field_name="medication_duration",
                raw_value=duration,
                normalized_value=base_normalized,
            )

            add_field(
                entity_type="medication",
                field_name="medication_route",
                raw_value=route,
                normalized_value=base_normalized,
            )

        lab_results = extraction.get("lab_results", [])

        for index, lab in enumerate(lab_results):
            if not isinstance(lab, dict):
                continue

            test_name = _text(lab.get("test_name")) or _text(lab.get("raw_text"))
            value = _text(lab.get("value"))
            unit = _text(lab.get("unit"))
            reference_range = _text(lab.get("reference_range"))
            raw_text = _text(lab.get("raw_text"))

            base_normalized = {
                "lab_index": index,
                "test_name": test_name,
                "reference_range": reference_range,
                "raw_text": raw_text,
            }

            add_field(
                entity_type="lab_result",
                field_name="test_name",
                raw_value=test_name,
                normalized_value=base_normalized,
            )

            add_field(
                entity_type="lab_result",
                field_name="value",
                raw_value=value,
                normalized_value=base_normalized,
                unit=unit,
            )

            add_field(
                entity_type="lab_result",
                field_name="reference_range",
                raw_value=reference_range,
                normalized_value=base_normalized,
            )

        if final_scores:
            overall_confidence = sum(final_scores) / len(final_scores)
        else:
            overall_confidence = max(0.0, min(1.0, ocr_mean * 0.40))

        document.document_type = extraction.get("document_type") or document.document_type
        document.overall_confidence = overall_confidence
        document.confidence_tier = confidence_tier(overall_confidence)
        document.status = "review_required"

        if not final_scores:
            document.failure_reason = "No structured fields extracted. Manual entry may be required."

        db.commit()
        return document

    except Exception as exc:
        if stage == "ocr":
            document.status = "ocr_failed"
        else:
            document.status = "extraction_failed"

        document.failure_reason = str(exc)[:2000]
        document.overall_confidence = 0.0
        document.confidence_tier = "tier4"

        db.commit()
        return document