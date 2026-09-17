from uuid import UUID
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_audit(
    db: Session,
    user_id: UUID,
    action: str,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
):
    try:
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address,
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()
