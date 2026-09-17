from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    action: str
    entity_type: str | None = None
    entity_id: UUID | None = None
    ip_address: str | None = None
    details: dict[str, Any] | None = None
    created_at: datetime
