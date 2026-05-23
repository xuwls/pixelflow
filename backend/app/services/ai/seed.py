"""First-run seed for ai_provider + ai_model.

Populates the catalog with the same entries the registry shipped with
when it was a Python constant. We read the DASHSCOPE key from settings
so the user doesn't have to enter it again — but only on the *first*
seed. After that, the DB is the source of truth and admin-edited keys
won't be clobbered.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_registry import AIModel, AIProvider

logger = logging.getLogger(__name__)


_DEFAULT_PROVIDERS: list[dict] = [
    {
        "name": "qwen",
        "display_name": "Qwen (Tongyi LLM)",
        "description": "Alibaba Tongyi Qwen text models via DashScope.",
    },
    {
        "name": "qwen_vl",
        "display_name": "Qwen-VL (Vision)",
        "description": "Alibaba Qwen-VL vision-language models via DashScope.",
    },
    {
        "name": "tongyi_wanxiang",
        "display_name": "Tongyi Wanxiang (Image)",
        "description": "Alibaba text-to-image models via DashScope.",
    },
    {
        "name": "ali_video",
        "display_name": "Ali Video (Wan)",
        "description": "Alibaba Wan video generation models via DashScope.",
    },
    {
        "name": "dashscope_tts",
        "display_name": "DashScope TTS (CosyVoice)",
        "description": "Alibaba CosyVoice TTS via DashScope.",
    },
]


# (provider_name, capability, model_name, display_name, is_default, default_params, description)
_DEFAULT_MODELS: list[tuple] = [
    # 文字编辑/生成 (VL + LLM + TTS)
    ("qwen_vl", "文字编辑/生成", "qwen-vl-max", "Qwen-VL Max", False,
     {"temperature": 0.7, "max_tokens": 2048},
     "Alibaba Qwen vision-language flagship. Best image understanding."),
    ("qwen_vl", "文字编辑/生成", "qwen-vl-plus", "Qwen-VL Plus", False,
     {"temperature": 0.7, "max_tokens": 2048},
     "Faster, cheaper Qwen-VL variant."),

    ("qwen", "文字编辑/生成", "qwen-max", "Qwen Max", True,
     {"temperature": 0.7, "max_tokens": 4096}, ""),
    ("qwen", "文字编辑/生成", "qwen-plus", "Qwen Plus", False,
     {"temperature": 0.7, "max_tokens": 4096}, ""),
    ("qwen", "文字编辑/生成", "qwen-turbo", "Qwen Turbo", False,
     {"temperature": 0.7, "max_tokens": 4096}, ""),

    ("dashscope_tts", "文字编辑/生成", "cosyvoice-v1", "CosyVoice v1", False,
     {"voice": "longxiaochun"}, ""),

    # 图片编辑/生成 (T2I + I2I)
    ("tongyi_wanxiang", "图片编辑/生成", "wanx-v1", "Wanxiang v1", True,
     {"width": 1024, "height": 1024}, ""),
    ("tongyi_wanxiang", "图片编辑/生成", "wanx2.1-t2i-turbo", "Wanxiang 2.1 Turbo", False,
     {"width": 1024, "height": 1024}, ""),
    ("tongyi_wanxiang", "图片编辑/生成", "wanx2.1-t2i-plus", "Wanxiang 2.1 Plus", False,
     {"width": 1024, "height": 1024}, ""),
    ("tongyi_wanxiang", "图片编辑/生成", "wanx2.1-imageedit", "Wanxiang Image Edit", False,
     {"width": 1024, "height": 1024},
     "Reference-image-driven image generation."),

    # 视频编辑/生成 (I2V + T2V)
    ("ali_video", "视频编辑/生成", "wan2.6-i2v-flash", "Wan 2.6 I2V Flash", True,
     {"duration_sec": 5}, ""),
    ("ali_video", "视频编辑/生成", "wan2.6-i2v", "Wan 2.6 I2V", False,
     {"duration_sec": 5}, ""),
    ("ali_video", "视频编辑/生成", "wan2.5-i2v-preview", "Wan 2.5 I2V Preview", False,
     {"duration_sec": 5}, ""),
    ("ali_video", "视频编辑/生成", "wan2.7-t2v", "Wan 2.7 T2V", False,
     {"duration_sec": 5}, ""),
    ("ali_video", "视频编辑/生成", "wan2.6-t2v", "Wan 2.6 T2V", False,
     {"duration_sec": 5}, ""),
]


_DASHSCOPE_PROVIDERS = {"qwen", "qwen_vl", "tongyi_wanxiang", "ali_video", "dashscope_tts"}


async def seed_if_empty(session: AsyncSession) -> bool:
    """Insert the default catalog when the table is empty.

    Returns True if rows were inserted, False if it skipped because the
    table already had data.
    """
    existing = await session.execute(select(AIProvider.id).limit(1))
    if existing.first() is not None:
        return False

    logger.info("Seeding ai_provider + ai_model with defaults")

    seed_key = settings.DASHSCOPE_API_KEY or ""
    providers_by_name: dict[str, AIProvider] = {}
    for spec in _DEFAULT_PROVIDERS:
        api_key = seed_key if spec["name"] in _DASHSCOPE_PROVIDERS else ""
        provider = AIProvider(
            name=spec["name"],
            display_name=spec["display_name"],
            description=spec["description"],
            api_key=api_key,
            base_url=None,
            enabled=True,
        )
        session.add(provider)
        providers_by_name[spec["name"]] = provider

    # Flush so the providers get IDs before we attach models.
    await session.flush()

    for sort, (
        provider_name, capability, model_name, display_name,
        is_default, default_params, description,
    ) in enumerate(_DEFAULT_MODELS):
        provider = providers_by_name[provider_name]
        session.add(
            AIModel(
                provider_id=provider.id,
                capability=capability,
                model_name=model_name,
                display_name=display_name,
                is_default=is_default,
                default_params=default_params,
                description=description,
                enabled=True,
                sort_order=sort,
            )
        )

    await session.commit()
    logger.info(
        "Seeded %d providers + %d models",
        len(_DEFAULT_PROVIDERS), len(_DEFAULT_MODELS),
    )
    return True
