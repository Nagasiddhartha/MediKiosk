from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_add_symptoms_and_bodymap"
down_revision = "0002_add_health_vault"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "symptom_encounters",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("chief_complaint", sa.String(length=255), nullable=True),
        sa.Column("raw_input", sa.Text(), nullable=True),
        sa.Column("structured_data", postgresql.JSONB(), nullable=True),
        sa.Column("duration", sa.String(length=100), nullable=True),
        sa.Column("severity", sa.String(length=50), nullable=True),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="in_progress",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "body_map_annotations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "encounter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("symptom_encounters.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("body_region", sa.String(length=100), nullable=False),
        sa.Column("sub_region", sa.String(length=100), nullable=True),
        sa.Column("laterality", sa.String(length=50), nullable=True),
        sa.Column("surface", sa.String(length=50), nullable=True),
        sa.Column("pain_type", sa.String(length=100), nullable=True),
        sa.Column("severity", sa.String(length=50), nullable=True),
        sa.Column("svg_element_id", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_table("body_map_annotations")
    op.drop_table("symptom_encounters")