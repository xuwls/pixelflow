from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "project"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cover_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    product_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    product_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)

    nodes: Mapped[list["WorkflowNode"]] = relationship(
        back_populates="project", passive_deletes=True
    )
    edges: Mapped[list["WorkflowEdge"]] = relationship(
        back_populates="project", passive_deletes=True
    )
    media_files: Mapped[list["MediaFile"]] = relationship(back_populates="project", passive_deletes=True)
    runs: Mapped[list["WorkflowRun"]] = relationship(back_populates="project", passive_deletes=True)


class WorkflowNode(Base, TimestampMixin):
    __tablename__ = "workflow_node"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    # 'text' | 'image' | 'video'
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    position_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # asset mode = no prompt, output set on creation
    # generation mode = has prompt + upstream edges, output set after run
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="idle", nullable=False)
    config_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    output_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    debug_log: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="nodes")


class WorkflowEdge(Base, TimestampMixin):
    __tablename__ = "workflow_edge"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    source_node_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("workflow_node.id", ondelete="CASCADE"), nullable=False
    )
    target_node_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("workflow_node.id", ondelete="CASCADE"), nullable=False
    )

    project: Mapped["Project"] = relationship(back_populates="edges")


class WorkflowRun(Base, TimestampMixin):
    __tablename__ = "workflow_run"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    node_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("workflow_node.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), default="running", nullable=False)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="runs")


class MediaFile(Base, TimestampMixin):
    __tablename__ = "media_file"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    node_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("workflow_node.id", ondelete="SET NULL"), nullable=True
    )
    file_type: Mapped[str] = mapped_column(String(32), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    scene_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="media_files")
