import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class BodyMapAnnotation(Base):
    __tablename__ = "body_map_annotations"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("symptom_encounters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    body_region: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    sub_region: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    laterality: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    surface: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    pain_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    severity: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    svg_element_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    encounter = relationship(
        "SymptomEncounter",
        back_populates="annotations",
    )