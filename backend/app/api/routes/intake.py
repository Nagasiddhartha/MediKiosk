from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.body_map_annotation import BodyMapAnnotation
from app.models.intake_message import IntakeMessage
from app.models.red_flag_event import RedFlagEvent
from app.models.symptom_encounter import SymptomEncounter
from app.models.user import User
from app.schemas.intake import (
    IntakeEncounterListItem,
    IntakeMessageRead,
    IntakeProcessRequest,
    IntakeProcessResponse,
    IntakeRedFlag,
    IntakeVoiceRequest,
)
from app.schemas.symptoms import SymptomEncounterRead
from app.services.intake_engine import extract_symptom_structure, generate_next_questions
from app.services.red_flags import evaluate_red_flags


router = APIRouter()


def get_encounter_or_404(
    encounter_id: UUID,
    user_id: UUID,
    db: Session,
) -> SymptomEncounter:
    encounter = db.scalar(
        select(SymptomEncounter).where(
            SymptomEncounter.id == encounter_id,
            SymptomEncounter.user_id == user_id,
        )
    )

    if encounter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Symptom encounter not found",
        )

    return encounter


@router.post(
    "/process",
    response_model=IntakeProcessResponse,
)
def process_intake_message(
    payload: IntakeProcessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.encounter_id:
        encounter = get_encounter_or_404(payload.encounter_id, current_user.id, db)
    else:
        encounter = SymptomEncounter(
            user_id=current_user.id,
            chief_complaint=None,
            raw_input=None,
            structured_data={},
            duration=None,
            severity=None,
            status="in_progress",
        )

        db.add(encounter)
        db.flush()

    user_message = IntakeMessage(
        encounter_id=encounter.id,
        role="user",
        content=payload.text,
    )

    db.add(user_message)

    extraction = extract_symptom_structure(
        text=payload.text,
        previous_structured=encounter.structured_data,
    )

    merged = dict(encounter.structured_data or {})

    for key, value in extraction.items():
        if key == "missing_fields":
            continue

        if value is not None:
            merged[key] = value

    encounter.structured_data = merged

    if extraction.get("chief_complaint"):
        encounter.chief_complaint = extraction.get("chief_complaint")
    elif not encounter.chief_complaint:
        encounter.chief_complaint = payload.text[:160]

    if extraction.get("duration"):
        encounter.duration = extraction.get("duration")

    if extraction.get("severity"):
        encounter.severity = extraction.get("severity")

    if encounter.raw_input:
        encounter.raw_input = encounter.raw_input + "\n" + payload.text
    else:
        encounter.raw_input = payload.text

    raw_flags = evaluate_red_flags(
        chief_complaint=encounter.chief_complaint,
        structured_data=merged,
    )

    response_flags: list[IntakeRedFlag] = []

    for flag in raw_flags:
        response_flags.append(
            IntakeRedFlag(
                rule_id=flag["rule_id"],
                severity=flag["severity"],
                message=flag["message"],
            )
        )

        event = RedFlagEvent(
            user_id=current_user.id,
            encounter_id=encounter.id,
            rule_id=flag["rule_id"],
            severity=flag["severity"],
            message=flag["message"],
            triggered_inputs={
                "chief_complaint": encounter.chief_complaint,
                "text": payload.text[:1000],
            },
        )

        db.add(event)

    urgent = len(response_flags) > 0

    if urgent:
        next_questions = []
        encounter.status = "urgent"
        assistant_content = "URGENT WARNING: " + " ".join(
            flag.message for flag in response_flags
        )
    else:
        next_questions = generate_next_questions(
            structured=merged,
            raw_text=payload.text,
        )

        if next_questions:
            encounter.status = "in_progress"
            assistant_content = "\n".join(next_questions)
        else:
            encounter.status = "completed"
            assistant_content = "Intake information captured."

    assistant_message = IntakeMessage(
        encounter_id=encounter.id,
        role="assistant",
        content=assistant_content,
        structured_payload={
            "next_questions": next_questions,
            "urgent": urgent,
        },
    )

    db.add(assistant_message)
    db.commit()
    db.refresh(encounter)

    return IntakeProcessResponse(
        encounter_id=encounter.id,
        status=encounter.status,
        urgent=urgent,
        structured=merged,
        next_questions=next_questions,
        red_flags=response_flags,
    )


@router.post(
    "/voice",
    response_model=IntakeProcessResponse,
)
def process_voice_intake(
    payload: IntakeVoiceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return process_intake_message(
        payload=IntakeProcessRequest(
            encounter_id=payload.encounter_id,
            text=payload.transcript,
        ),
        current_user=current_user,
        db=db,
    )


@router.get(
    "/encounters",
    response_model=list[IntakeEncounterListItem],
)
def list_intake_encounters(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounters = db.scalars(
        select(SymptomEncounter)
        .where(SymptomEncounter.user_id == current_user.id)
        .order_by(SymptomEncounter.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    result = []
    for enc in encounters:
        msg_count = db.scalar(
            select(func.count(IntakeMessage.id)).where(IntakeMessage.encounter_id == enc.id)
        ) or 0
        anno_count = db.scalar(
            select(func.count(BodyMapAnnotation.id)).where(BodyMapAnnotation.encounter_id == enc.id)
        ) or 0

        result.append(
            IntakeEncounterListItem(
                id=enc.id,
                chief_complaint=enc.chief_complaint,
                duration=enc.duration,
                severity=enc.severity,
                status=enc.status,
                message_count=msg_count,
                annotations_count=anno_count,
                created_at=enc.created_at,
                updated_at=enc.updated_at,
            )
        )

    return result


@router.get(
    "/encounters/{encounter_id}",
    response_model=SymptomEncounterRead,
)
def get_intake_encounter(
    encounter_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounter = db.scalar(
        select(SymptomEncounter)
        .options(selectinload(SymptomEncounter.annotations))
        .where(
            SymptomEncounter.id == encounter_id,
            SymptomEncounter.user_id == current_user.id,
        )
    )

    if encounter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Symptom encounter not found",
        )

    return encounter


@router.get(
    "/encounters/{encounter_id}/messages",
    response_model=list[IntakeMessageRead],
)
def get_intake_messages(
    encounter_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Ensure user owns encounter
    get_encounter_or_404(encounter_id, current_user.id, db)

    messages = db.scalars(
        select(IntakeMessage)
        .where(IntakeMessage.encounter_id == encounter_id)
        .order_by(IntakeMessage.created_at.asc())
    ).all()

    return messages