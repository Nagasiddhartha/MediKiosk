from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.red_flag_event import RedFlagEvent
from app.models.user import User
from app.schemas.red_flags import RedFlagCheckRequest, RedFlagCheckResponse, RedFlagResult
from app.services.red_flags import evaluate_red_flags


router = APIRouter()


@router.post(
    "/check",
    response_model=RedFlagCheckResponse,
)
def check_red_flags(
    payload: RedFlagCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw_flags = evaluate_red_flags(
        chief_complaint=payload.chief_complaint,
        structured_data=payload.structured_data,
    )
    
    results = []
    for flag in raw_flags:
        results.append(RedFlagResult(
            rule_id=flag["rule_id"],
            severity=flag["severity"],
            message=flag["message"],
        ))
        
        event = RedFlagEvent(
            user_id=current_user.id,
            encounter_id=payload.encounter_id,
            rule_id=flag["rule_id"],
            severity=flag["severity"],
            message=flag["message"],
            triggered_inputs={"text": flag.get("matched_text")},
        )
        db.add(event)
        
    db.commit()
    
    return RedFlagCheckResponse(
        triggered=len(results) > 0,
        flags=results,
    )


@router.get(
    "",
    response_model=list[dict],
)
def list_red_flags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    flags = db.scalars(
        select(RedFlagEvent)
        .where(RedFlagEvent.user_id == current_user.id)
        .order_by(RedFlagEvent.created_at.desc())
    ).all()

    return [
        {
            "id": str(f.id),
            "rule_id": f.rule_id,
            "severity": f.severity,
            "message": f.message,
            "encounter_id": str(f.encounter_id) if f.encounter_id else None,
            "triggered_inputs": f.triggered_inputs,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in flags
    ]