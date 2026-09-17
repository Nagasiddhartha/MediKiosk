from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0005_add_documents"
down_revision = "0004_add_readings_and_redflags"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("document_type", sa.String(length=100), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("stored_path", sa.String(length=1024), nullable=True),
        sa.Column("file_hash", sa.String(length=128), nullable=True),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="uploaded"),
        sa.Column("overall_confidence", sa.Float(), nullable=True),
        sa.Column("confidence_tier", sa.String(length=20), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
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
        "document_ocr_outputs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("cleaned_text", sa.Text(), nullable=True),
        sa.Column("ocr_engine", sa.String(length=100), nullable=True),
        sa.Column("language", sa.String(length=50), nullable=True),
        sa.Column("mean_word_confidence", sa.Float(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("preprocessing_metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "extracted_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.Column("normalized_value", postgresql.JSONB(), nullable=True),
        sa.Column("unit", sa.String(length=100), nullable=True),
        sa.Column("ocr_confidence", sa.Float(), nullable=True),
        sa.Column("llm_confidence", sa.Float(), nullable=True),
        sa.Column("final_confidence", sa.Float(), nullable=True),
        sa.Column("confidence_tier", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending_review"),
        sa.Column("user_corrected_value", sa.Text(), nullable=True),
        sa.Column("review_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("extracted_fields")
    op.drop_table("document_ocr_outputs")
    op.drop_table("documents")