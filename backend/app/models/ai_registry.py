from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AIProvider(Base, TimestampMixin):
    __tablename__ = "ai_provider"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    api_key: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    base_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    models: Mapped[list["AIModel"]] = relationship(
        back_populates="provider",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class AIModel(Base, TimestampMixin):
    __tablename__ = "ai_model"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_provider.id", ondelete="CASCADE"), nullable=False
    )
    capability: Mapped[str] = mapped_column(String(16), nullable=False)
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    default_params: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    provider: Mapped["AIProvider"] = relationship(back_populates="models")

    __table_args__ = (
        UniqueConstraint("provider_id", "model_name", name="uq_ai_model_provider_modelname"),
    )
