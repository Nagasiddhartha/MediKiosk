from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.allergy import Allergy
from app.models.chronic_condition import ChronicCondition
from app.models.document import Document
from app.models.health_reading import HealthReading
from app.models.medication import Medication
from app.models.red_flag_event import RedFlagEvent
from app.models.symptom_encounter import SymptomEncounter
from app.models.visit import Visit


def _to_datetime(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)

    return None


def _passes_date_filter(event_datetime, start_date, end_date):
    if event_datetime is None:
        return False

    event_date = event_datetime.date()

    if start_date and event_date < start_date:
        return False

    if end_date and event_date > end_date:
        return False

    return True


def build_timeline(
    user_id: UUID,
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    types: list[str] | None = None,
    search: str | None = None,
) -> list[dict]:
    events: list[dict] = []

    def add_event(
        event_type: str,
        event_date,
        title: str,
        summary: str | None = None,
        entity_id: UUID | None = None,
        source: str | None = None,
        trust_status: str | None = None,
    ):
        if types and event_type not in types:
            return

        normalized_date = _to_datetime(event_date)

        if normalized_date is None:
            return

        if not _passes_date_filter(normalized_date, start_date, end_date):
            return

        events.append({
            "event_type": event_type,
            "event_date": normalized_date,
            "title": title,
            "summary": summary,
            "entity_id": entity_id,
            "source": source,
            "trust_status": trust_status,
        })

    visits = db.scalars(
        select(Visit).where(Visit.user_id == user_id)
    ).all()

    for visit in visits:
        title_parts = []

        if visit.provider_name:
            title_parts.append(visit.provider_name)

        if visit.facility_name:
            title_parts.append(visit.facility_name)

        title = "Doctor visit"
        if title_parts:
            title = "Doctor visit — " + ", ".join(title_parts)

        summary_parts = []

        if visit.reason:
            summary_parts.append(f"Reason: {visit.reason}")

        if visit.diagnosis:
            summary_parts.append(f"Diagnosis: {visit.diagnosis}")

        add_event(
            event_type="visit",
            event_date=visit.visit_date,
            title=title,
            summary=" | ".join(summary_parts) if summary_parts else None,
            entity_id=visit.id,
            source="user_entry",
            trust_status="user_confirmed",
        )

    conditions = db.scalars(
        select(ChronicCondition).where(ChronicCondition.user_id == user_id)
    ).all()

    for condition in conditions:
        summary_parts = [f"Status: {condition.status}"]

        if condition.diagnosed_date:
            summary_parts.append(f"Diagnosed: {condition.diagnosed_date}")

        if condition.notes:
            summary_parts.append(condition.notes)

        add_event(
            event_type="condition",
            event_date=condition.diagnosed_date or condition.created_at,
            title=f"Condition: {condition.name}",
            summary=" | ".join(summary_parts),
            entity_id=condition.id,
            source="user_entry",
            trust_status="user_confirmed",
        )

    medications = db.scalars(
        select(Medication).where(Medication.user_id == user_id)
    ).all()

    for medication in medications:
        title = f"Medication: {medication.drug_name}"

        if medication.dosage:
            title += f" {medication.dosage}"

        summary_parts = []

        if medication.frequency:
            summary_parts.append(f"Frequency: {medication.frequency}")

        if medication.route:
            summary_parts.append(f"Route: {medication.route}")

        summary_parts.append(f"Active: {medication.is_active}")

        add_event(
            event_type="medication",
            event_date=medication.start_date or medication.created_at,
            title=title,
            summary=" | ".join(summary_parts),
            entity_id=medication.id,
            source="user_entry",
            trust_status="user_confirmed",
        )

    allergies = db.scalars(
        select(Allergy).where(Allergy.user_id == user_id)
    ).all()

    for allergy in allergies:
        summary_parts = [f"Severity: {allergy.severity}"]

        if allergy.reaction_type:
            summary_parts.append(f"Reaction: {allergy.reaction_type}")

        if allergy.notes:
            summary_parts.append(allergy.notes)

        add_event(
            event_type="allergy",
            event_date=allergy.created_at,
            title=f"Allergy: {allergy.allergen}",
            summary=" | ".join(summary_parts),
            entity_id=allergy.id,
            source="user_entry",
            trust_status="user_confirmed",
        )

    symptom_encounters = db.scalars(
        select(SymptomEncounter).where(SymptomEncounter.user_id == user_id)
    ).all()

    for encounter in symptom_encounters:
        title = encounter.chief_complaint or "Reported symptom"

        summary_parts = []

        if encounter.duration:
            summary_parts.append(f"Duration: {encounter.duration}")

        if encounter.severity:
            summary_parts.append(f"Severity: {encounter.severity}")

        summary_parts.append(f"Status: {encounter.status}")

        if encounter.raw_input:
            summary_parts.append(f"Reported: {encounter.raw_input[:160]}")

        add_event(
            event_type="symptom",
            event_date=encounter.created_at,
            title=title,
            summary=" | ".join(summary_parts),
            entity_id=encounter.id,
            source="symptom_intake",
            trust_status="patient_reported",
        )

    readings = db.scalars(
        select(HealthReading).where(HealthReading.user_id == user_id)
    ).all()

    for reading in readings:
        reading_type = reading.reading_type.replace("_", " ").title()

        if reading.reading_type == "blood_pressure":
            value = f"{reading.systolic}/{reading.diastolic}"
            title = f"Blood Pressure: {value}"
        else:
            value = reading.value_text or str(reading.numeric_value)
            title = f"{reading_type}: {value}"

            if reading.unit:
                title += f" {reading.unit}"

        add_event(
            event_type="reading",
            event_date=reading.recorded_at,
            title=title,
            summary=f"Source: {reading.source or 'manual'}",
            entity_id=reading.id,
            source=reading.source or "manual",
            trust_status="imported" if reading.source == "csv_import" else "user_confirmed",
        )

    documents = db.scalars(
        select(Document).where(Document.user_id == user_id)
    ).all()

    for document in documents:
        title = document.title or document.original_filename or "Document"

        summary_parts = []

        if document.document_type:
            summary_parts.append(f"Type: {document.document_type}")

        summary_parts.append(f"Status: {document.status}")

        if document.confidence_tier:
            summary_parts.append(f"Confidence: {document.confidence_tier}")

        add_event(
            event_type="document",
            event_date=document.created_at,
            title=title,
            summary=" | ".join(summary_parts),
            entity_id=document.id,
            source="document_upload",
            trust_status=document.status,
        )

    red_flags = db.scalars(
        select(RedFlagEvent).where(RedFlagEvent.user_id == user_id)
    ).all()

    for flag in red_flags:
        add_event(
            event_type="red_flag",
            event_date=flag.created_at,
            title=f"Red flag: {flag.rule_id}",
            summary=flag.message,
            entity_id=flag.id,
            source="rule_engine",
            trust_status=flag.severity,
        )

    events.sort(key=lambda item: item["event_date"], reverse=True)

    if search:
        term = search.lower().strip()
        events = [
            ev for ev in events
            if (ev.get("title") and term in ev["title"].lower())
            or (ev.get("summary") and term in ev["summary"].lower())
        ]

    return events


def group_timeline_by_month(events: list[dict]) -> list[dict]:
    groups_dict: dict[tuple[int, int], list[dict]] = {}

    for ev in events:
        dt = ev["event_date"]
        key = (dt.year, dt.month)
        if key not in groups_dict:
            groups_dict[key] = []
        groups_dict[key].append(ev)

    result = []
    for (year, month), grp_events in sorted(groups_dict.items(), key=lambda x: x[0], reverse=True):
        period_str = datetime(year, month, 1, tzinfo=timezone.utc).strftime("%B %Y")
        result.append({
            "period": period_str,
            "year": year,
            "month": month,
            "events": grp_events,
        })
    return result