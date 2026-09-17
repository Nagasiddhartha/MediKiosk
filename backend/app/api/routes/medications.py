from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.medication import Medication
from app.models.user import User
from app.schemas.vault import MedicationCreate, MedicationRead, MedicationUpdate


router = APIRouter()


def get_medication_or_404(
    medication_id: UUID,
    user_id: UUID,
    db: Session,
) -> Medication:
    medication = db.scalar(
        select(Medication).where(
            Medication.id == medication_id,
            Medication.user_id == user_id,
        )
    )

    if medication is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found",
        )

    return medication


@router.get(
    "",
    response_model=list[MedicationRead],
)
def list_medications(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medications = db.scalars(
        select(Medication)
        .where(Medication.user_id == current_user.id)
        .order_by(Medication.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return medications


@router.post(
    "",
    response_model=MedicationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_medication(
    payload: MedicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medication = Medication(
        user_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(medication)
    db.commit()
    db.refresh(medication)

    return medication


@router.get(
    "/{medication_id}",
    response_model=MedicationRead,
)
def get_medication(
    medication_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_medication_or_404(
        medication_id=medication_id,
        user_id=current_user.id,
        db=db,
    )


@router.put(
    "/{medication_id}",
    response_model=MedicationRead,
)
def update_medication(
    medication_id: UUID,
    payload: MedicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medication = get_medication_or_404(
        medication_id=medication_id,
        user_id=current_user.id,
        db=db,
    )

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(medication, field, value)

    db.commit()
    db.refresh(medication)

    return medication


@router.delete(
    "/{medication_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_medication(
    medication_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medication = get_medication_or_404(
        medication_id=medication_id,
        user_id=current_user.id,
        db=db,
    )

    db.delete(medication)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)