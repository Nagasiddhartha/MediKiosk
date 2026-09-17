from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.allergy import Allergy
from app.models.user import User
from app.schemas.vault import AllergyCreate, AllergyRead, AllergyUpdate


router = APIRouter()


def get_allergy_or_404(
    allergy_id: UUID,
    user_id: UUID,
    db: Session,
) -> Allergy:
    allergy = db.scalar(
        select(Allergy).where(
            Allergy.id == allergy_id,
            Allergy.user_id == user_id,
        )
    )

    if allergy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allergy not found",
        )

    return allergy


@router.get(
    "",
    response_model=list[AllergyRead],
)
def list_allergies(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allergies = db.scalars(
        select(Allergy)
        .where(Allergy.user_id == current_user.id)
        .order_by(Allergy.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return allergies


@router.post(
    "",
    response_model=AllergyRead,
    status_code=status.HTTP_201_CREATED,
)
def create_allergy(
    payload: AllergyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allergy = Allergy(
        user_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(allergy)
    db.commit()
    db.refresh(allergy)

    return allergy


@router.get(
    "/{allergy_id}",
    response_model=AllergyRead,
)
def get_allergy(
    allergy_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_allergy_or_404(
        allergy_id=allergy_id,
        user_id=current_user.id,
        db=db,
    )


@router.put(
    "/{allergy_id}",
    response_model=AllergyRead,
)
def update_allergy(
    allergy_id: UUID,
    payload: AllergyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allergy = get_allergy_or_404(
        allergy_id=allergy_id,
        user_id=current_user.id,
        db=db,
    )

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(allergy, field, value)

    db.commit()
    db.refresh(allergy)

    return allergy


@router.delete(
    "/{allergy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_allergy(
    allergy_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allergy = get_allergy_or_404(
        allergy_id=allergy_id,
        user_id=current_user.id,
        db=db,
    )

    db.delete(allergy)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)