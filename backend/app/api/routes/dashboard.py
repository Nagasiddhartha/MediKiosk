from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.allergy import Allergy
from app.models.chronic_condition import ChronicCondition
from app.models.document import Document
from app.models.health_reading import HealthReading
from app.models.medication import Medication
from app.models.patient_profile import PatientProfile
from app.models.red_flag_event import RedFlagEvent
from app.models.symptom_encounter import SymptomEncounter
from app.models.user import User
from app.schemas.dashboard import (
    DashboardOverviewResponse,
    DashboardStats,
    LatestEncounterSummary,
    LatestReadingSummary,
)
from app.services.timeline import build_timeline

router = APIRouter()


@router.get(
    "/overview",
    response_model=DashboardOverviewResponse,
)
def get_dashboard_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # Counts
    active_conditions = db.scalar(
        select(func.count(ChronicCondition.id)).where(
            ChronicCondition.user_id == current_user.id,
            ChronicCondition.status == "active",
        )
    ) or 0

    active_meds = db.scalar(
        select(func.count(Medication.id)).where(
            Medication.user_id == current_user.id,
            Medication.is_active == True,
        )
    ) or 0

    allergies_count = db.scalar(
        select(func.count(Allergy.id)).where(
            Allergy.user_id == current_user.id,
        )
    ) or 0

    pending_docs = db.scalar(
        select(func.count(Document.id)).where(
            Document.user_id == current_user.id,
            Document.status.in_(["uploaded", "review_required"]),
        )
    ) or 0

    confirmed_docs = db.scalar(
        select(func.count(Document.id)).where(
            Document.user_id == current_user.id,
            Document.status == "confirmed",
        )
    ) or 0

    recent_flags_count = db.scalar(
        select(func.count(RedFlagEvent.id)).where(
            RedFlagEvent.user_id == current_user.id,
            RedFlagEvent.created_at >= thirty_days_ago,
        )
    ) or 0

    # Profile completeness
    profile = db.scalar(
        select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    )
    has_profile = profile is not None
    completeness = 0
    if profile:
        fields = [
            profile.full_name,
            profile.date_of_birth,
            profile.sex,
            profile.blood_group,
            profile.emergency_contact_phone,
        ]
        filled = sum(1 for f in fields if f)
        completeness = int((filled / len(fields)) * 100)

    # Latest reading
    latest_reading_db = db.scalar(
        select(HealthReading)
        .where(HealthReading.user_id == current_user.id)
        .order_by(HealthReading.recorded_at.desc())
        .limit(1)
    )

    latest_reading = None
    if latest_reading_db:
        if latest_reading_db.reading_type == "blood_pressure":
            display_val = f"{latest_reading_db.systolic}/{latest_reading_db.diastolic}"
            unit = "mmHg"
            is_caution = bool(
                (latest_reading_db.systolic and latest_reading_db.systolic >= 140)
                or (latest_reading_db.diastolic and latest_reading_db.diastolic >= 90)
            )
        else:
            display_val = latest_reading_db.value_text or str(latest_reading_db.numeric_value or "")
            unit = latest_reading_db.unit
            is_caution = False
            if latest_reading_db.reading_type == "blood_glucose" and latest_reading_db.numeric_value:
                is_caution = latest_reading_db.numeric_value >= 126

        latest_reading = LatestReadingSummary(
            id=latest_reading_db.id,
            reading_type=latest_reading_db.reading_type,
            display_value=display_val,
            unit=unit,
            recorded_at=latest_reading_db.recorded_at,
            is_caution=is_caution,
        )

    # Latest symptom encounter
    latest_enc_db = db.scalar(
        select(SymptomEncounter)
        .where(SymptomEncounter.user_id == current_user.id)
        .order_by(SymptomEncounter.created_at.desc())
        .limit(1)
    )

    latest_encounter = None
    if latest_enc_db:
        latest_encounter = LatestEncounterSummary(
            id=latest_enc_db.id,
            chief_complaint=latest_enc_db.chief_complaint,
            duration=latest_enc_db.duration,
            severity=latest_enc_db.severity,
            status=latest_enc_db.status,
            created_at=latest_enc_db.created_at,
        )

    # Recent timeline (last 5)
    timeline_events = build_timeline(current_user.id, db)
    recent_timeline = timeline_events[:5]

    # Active urgent warning
    recent_red_flag = db.scalar(
        select(RedFlagEvent)
        .where(
            RedFlagEvent.user_id == current_user.id,
            RedFlagEvent.created_at >= seven_days_ago,
        )
        .order_by(RedFlagEvent.created_at.desc())
        .limit(1)
    )

    urgent_active = recent_red_flag is not None
    urgent_msg = recent_red_flag.message if recent_red_flag else None

    is_summary_ready = (
        has_profile
        or active_conditions > 0
        or active_meds > 0
        or latest_reading is not None
        or latest_encounter is not None
    )

    stats = DashboardStats(
        active_conditions=active_conditions,
        active_medications=active_meds,
        allergies_count=allergies_count,
        pending_documents=pending_docs,
        confirmed_documents=confirmed_docs,
        recent_red_flags=recent_flags_count,
        profile_completeness_percent=completeness,
        has_profile=has_profile,
        is_summary_ready=is_summary_ready,
    )

    return DashboardOverviewResponse(
        stats=stats,
        latest_reading=latest_reading,
        latest_encounter=latest_encounter,
        recent_timeline=recent_timeline,
        urgent_warning_active=urgent_active,
        urgent_warning_message=urgent_msg,
    )
