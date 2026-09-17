from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.visit import Visit
from app.models.user import User
from app.schemas.vault import VisitCreate, VisitRead, VisitUpdate


router = APIRouter()


def get_visit_or_404(
    visit_id: UUID,
    user_id: UUID,
    db: Session,
) -> Visit:
    visit = db.scalar(
        select(Visit).where(
            Visit.id == visit_id,
            Visit.user_id == user_id,
        )
    )

    if visit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found",
        )

    return visit


@router.get(
    "",
    response_model=list[VisitRead],
)
def list_visits(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    visits = db.scalars(
        select(Visit)
        .where(Visit.user_id == current_user.id)
        .order_by(Visit.visit_date.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return visits


@router.post(
    "",
    response_model=VisitRead,
    status_code=status.HTTP_201_CREATED,
)
def create_visit(
    payload: VisitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    visit = Visit(
        user_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(visit)
    db.commit()
    db.refresh(visit)

    return visit


@router.get(
    "/{visit_id}",
    response_model=VisitRead,
)
def get_visit(
    visit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_visit_or_404(
        visit_id=visit_id,
        user_id=current_user.id,
        db=db,
    )


@router.put(
    "/{visit_id}",
    response_model=VisitRead,
)
def update_visit(
    visit_id: UUID,
    payload: VisitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    visit = get_visit_or_404(
        visit_id=visit_id,
        user_id=current_user.id,
        db=db,
    )

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(visit, field, value)

    db.commit()
    db.refresh(visit)

    return visit


@router.delete(
    "/{visit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_visit(
    visit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    visit = get_visit_or_404(
        visit_id=visit_id,
        user_id=current_user.id,
        db=db,
    )

    db.delete(visit)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)