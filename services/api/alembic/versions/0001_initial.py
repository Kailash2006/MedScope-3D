"""initial schema: sessions, assessments, audit_logs

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-15
"""
import sqlalchemy as sa

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("sex", sa.String(length=8), nullable=True),
        sa.Column("regions", sa.JSON(), nullable=True),
        sa.Column("symptoms", sa.JSON(), nullable=True),
        sa.Column("risk_factors", sa.JSON(), nullable=True),
        sa.Column("vitals", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "assessments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("urgency", sa.String(length=24), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("decision_path", sa.String(length=32), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=True),
        sa.Column("model_version", sa.String(length=32), nullable=False),
        sa.Column("engine_version", sa.String(length=32), nullable=False),
        sa.Column("input_snapshot", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_assessments_session_id", "assessments", ["session_id"])
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=48), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_index("ix_assessments_session_id", table_name="assessments")
    op.drop_table("assessments")
    op.drop_table("sessions")
