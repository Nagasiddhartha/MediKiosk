from datetime import date
from typing import Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.timeline import GroupedTimelinePeriod, TimelineEventRead, TimelineResponse
from app.services.timeline import build_timeline, group_timeline_by_month


router = APIRouter()


@router.get(
    "",
    response_model=Union[TimelineResponse, list[TimelineEventRead]],
)
def get_timeline(
    start_date: date | None = None,
    end_date: date | None = None,
    types: str | None = None,
    search: str | None = None,
    group: str | None = None,
    limit: int = Query(default=500, ge=1, le=2000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    type_list = None

    if types:
        type_list = [item.strip() for item in types.split(",") if item.strip()]

    events = build_timeline(
        user_id=current_user.id,
        db=db,
        start_date=start_date,
        end_date=end_date,
        types=type_list,
        search=search,
    )

    limited = events[:limit]

    if group == "month":
        grouped_data = group_timeline_by_month(limited)
        return TimelineResponse(
            total_events=len(limited),
            events=[TimelineEventRead(**ev) for ev in limited],
            groups=[GroupedTimelinePeriod(**g) for g in grouped_data],
        )

    return limited