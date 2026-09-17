from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.body_map_annotation import BodyMapAnnotation
from app.models.symptom_encounter import SymptomEncounter
from app.models.user import User
from app.schemas.symptoms import (
    BodyMapAnnotationCreate,
    BodyMapAnnotationRead,
    SymptomEncounterCreate,
    SymptomEncounterRead,
    SymptomEncounterUpdate,
)


router = APIRouter()


def get_encounter_or_404(
    encounter_id: UUID,
    user_id: UUID,
    db: Session,
) -> SymptomEncounter:
    encounter = db.scalar(
        select(SymptomEncounter)
        .options(selectinload(SymptomEncounter.annotations))
        .where(
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


@router.get(
    "",
    response_model=list[SymptomEncounterRead],
)
def list_encounters(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounters = db.scalars(
        select(SymptomEncounter)
        .options(selectinload(SymptomEncounter.annotations))
        .where(SymptomEncounter.user_id == current_user.id)
        .order_by(SymptomEncounter.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return encounters


@router.post(
    "",
    response_model=SymptomEncounterRead,
    status_code=status.HTTP_201_CREATED,
)
def create_encounter(
    payload: SymptomEncounterCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounter = SymptomEncounter(
        user_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(encounter)
    db.commit()
    db.refresh(encounter)

    return get_encounter_or_404(encounter.id, current_user.id, db)


@router.get(
    "/{encounter_id}",
    response_model=SymptomEncounterRead,
)
def get_encounter(
    encounter_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_encounter_or_404(encounter_id, current_user.id, db)


@router.put(
    "/{encounter_id}",
    response_model=SymptomEncounterRead,
)
def update_encounter(
    encounter_id: UUID,
    payload: SymptomEncounterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounter = get_encounter_or_404(encounter_id, current_user.id, db)

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(encounter, field, value)

    db.commit()
    db.refresh(encounter)

    return get_encounter_or_404(encounter_id, current_user.id, db)


@router.delete(
    "/{encounter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_encounter(
    encounter_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounter = get_encounter_or_404(encounter_id, current_user.id, db)

    db.delete(encounter)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{encounter_id}/annotations",
    response_model=BodyMapAnnotationRead,
    status_code=status.HTTP_201_CREATED,
)
def add_annotation(
    encounter_id: UUID,
    payload: BodyMapAnnotationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounter = get_encounter_or_404(encounter_id, current_user.id, db)

    annotation = BodyMapAnnotation(
        encounter_id=encounter.id,
        **payload.model_dump(),
    )

    db.add(annotation)
    db.commit()
    db.refresh(annotation)

    return annotation


@router.delete(
    "/{encounter_id}/annotations/{annotation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_annotation(
    encounter_id: UUID,
    annotation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encounter = get_encounter_or_404(encounter_id, current_user.id, db)

    annotation = db.scalar(
        select(BodyMapAnnotation).where(
            BodyMapAnnotation.id == annotation_id,
            BodyMapAnnotation.encounter_id == encounter.id,
        )
    )

    if annotation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found",
        )

    db.delete(annotation)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)