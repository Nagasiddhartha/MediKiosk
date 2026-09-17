from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.patient_profile import PatientProfile
from app.models.user import User
from app.schemas.vault import PatientProfileCreate, PatientProfileRead, PatientProfileUpdate


router = APIRouter()


@router.get(
    "",
    response_model=PatientProfileRead,
)
@router.get(
    "/me",
    response_model=PatientProfileRead,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.scalar(
        select(PatientProfile).where(
            PatientProfile.user_id == current_user.id
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    return profile


@router.post(
    "/me",
    response_model=PatientProfileRead,
    status_code=status.HTTP_201_CREATED,
)
def create_my_profile(
    payload: PatientProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_profile = db.scalar(
        select(PatientProfile).where(
            PatientProfile.user_id == current_user.id
        )
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Patient profile already exists",
        )

    profile = PatientProfile(
        user_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


@router.put(
    "",
    response_model=PatientProfileRead,
)
@router.put(
    "/me",
    response_model=PatientProfileRead,
)
def update_my_profile(
    payload: PatientProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.scalar(
        select(PatientProfile).where(
            PatientProfile.user_id == current_user.id
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile