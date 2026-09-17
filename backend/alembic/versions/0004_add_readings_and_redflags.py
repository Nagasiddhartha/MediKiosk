from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004_add_readings_and_redflags"
down_revision = "0003_add_symptoms_and_bodymap"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "csv_import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("invalid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "health_readings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reading_type", sa.String(length=100), nullable=False),
        sa.Column("systolic", sa.Integer(), nullable=True),
        sa.Column("diastolic", sa.Integer(), nullable=True),
        sa.Column("numeric_value", sa.Float(), nullable=True),
        sa.Column("value_text", sa.String(length=100), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("import_batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("csv_import_batches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "red_flag_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("symptom_encounters.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rule_id", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("triggered_inputs", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("red_flag_events")
    op.drop_table("health_readings")
    op.drop_table("csv_import_batches")