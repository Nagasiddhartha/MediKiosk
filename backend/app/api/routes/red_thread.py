from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.red_thread import (
    RedThreadHistoricalEvent,
    RedThreadQueryRequest,
    RedThreadQueryResponse,
)
from app.services.red_thread import query_red_thread

router = APIRouter()


@router.post(
    "/query",
    response_model=RedThreadQueryResponse,
)
def find_relevant_history(
    payload: RedThreadQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    insights_raw = query_red_thread(
        db=db,
        user_id=current_user.id,
        current_complaint=payload.current_complaint,
        structured_data=payload.structured_data,
        body_region=payload.body_region,
        limit=payload.limit,
    )

    insights = [RedThreadHistoricalEvent(**item) for item in insights_raw]

    return RedThreadQueryResponse(
        current_complaint=payload.current_complaint,
        relevant_events_count=len(insights),
        insights=insights,
    )
