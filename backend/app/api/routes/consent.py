from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.consent import UserConsent
from app.models.user import User
from app.schemas.consent import ConsentUpdateRequest, UserConsentRead
from app.services.audit import log_audit

router = APIRouter()

DEFAULT_CONSENT_TYPES = [
    "ai_processing",
    "ocr_processing",
    "data_analytics",
    "data_export",
]


@router.get(
    "",
    response_model=list[UserConsentRead],
)
def get_user_consents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consents = db.scalars(
        select(UserConsent).where(UserConsent.user_id == current_user.id)
    ).all()

    existing_types = {c.consent_type for c in consents}
    for c_type in DEFAULT_CONSENT_TYPES:
        if c_type not in existing_types:
            new_c = UserConsent(
                user_id=current_user.id,
                consent_type=c_type,
                status="granted",
                version="1.0",
            )
            db.add(new_c)

    db.commit()

    return db.scalars(
        select(UserConsent)
        .where(UserConsent.user_id == current_user.id)
        .order_by(UserConsent.consent_type.asc())
    ).all()


@router.post(
    "",
    response_model=UserConsentRead,
)
def update_user_consent(
    payload: ConsentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consent = db.scalar(
        select(UserConsent).where(
            UserConsent.user_id == current_user.id,
            UserConsent.consent_type == payload.consent_type,
        )
    )

    status_str = "granted" if payload.granted else "revoked"

    if consent:
        consent.status = status_str
        consent.updated_at = datetime.now(timezone.utc)
    else:
        consent = UserConsent(
            user_id=current_user.id,
            consent_type=payload.consent_type,
            status=status_str,
            version="1.0",
        )
        db.add(consent)

    db.commit()
    db.refresh(consent)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="consent_updated",
        entity_type="consent",
        entity_id=consent.id,
        details={"type": payload.consent_type, "status": status_str},
    )

    return consent
