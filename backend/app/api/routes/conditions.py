from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.chronic_condition import ChronicCondition
from app.models.user import User
from app.schemas.vault import ChronicConditionCreate, ChronicConditionRead, ChronicConditionUpdate


router = APIRouter()


def get_condition_or_404(
    condition_id: UUID,
    user_id: UUID,
    db: Session,
) -> ChronicCondition:
    condition = db.scalar(
        select(ChronicCondition).where(
            ChronicCondition.id == condition_id,
            ChronicCondition.user_id == user_id,
        )
    )

    if condition is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chronic condition not found",
        )

    return condition


@router.get(
    "",
    response_model=list[ChronicConditionRead],
)
def list_chronic_conditions(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conditions = db.scalars(
        select(ChronicCondition)
        .where(ChronicCondition.user_id == current_user.id)
        .order_by(ChronicCondition.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return conditions


@router.post(
    "",
    response_model=ChronicConditionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_chronic_condition(
    payload: ChronicConditionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    condition = ChronicCondition(
        user_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(condition)
    db.commit()
    db.refresh(condition)

    return condition


@router.get(
    "/{condition_id}",
    response_model=ChronicConditionRead,
)
def get_chronic_condition(
    condition_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_condition_or_404(
        condition_id=condition_id,
        user_id=current_user.id,
        db=db,
    )


@router.put(
    "/{condition_id}",
    response_model=ChronicConditionRead,
)
def update_chronic_condition(
    condition_id: UUID,
    payload: ChronicConditionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    condition = get_condition_or_404(
        condition_id=condition_id,
        user_id=current_user.id,
        db=db,
    )

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(condition, field, value)

    db.commit()
    db.refresh(condition)

    return condition


@router.delete(
    "/{condition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_chronic_condition(
    condition_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    condition = get_condition_or_404(
        condition_id=condition_id,
        user_id=current_user.id,
        db=db,
    )

    db.delete(condition)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)