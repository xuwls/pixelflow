"""Qwen-VL (vision-language) model implementation.

Reads images either via a public URL or by downloading from MinIO and
inlining as base64 — DashScope can't reach our local MinIO directly so
we paste the bytes into the message.
"""

from __future__ import annotations

import base64
import logging
import mimetypes
from typing import Optional
from urllib.parse import urlparse

import httpx
from dashscope import MultiModalConversation

from app.config import settings
from app.services.ai.base import BaseVisionModel
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


class QwenVLModel(BaseVisionModel):
    provider = "qwen_vl"

    def __init__(
        self,
        model_name: str = "qwen-vl-max",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.DASHSCOPE_API_KEY
        self.base_url = base_url
        self.model_name = model_name

    async def generate_text(
        self,
        prompt: str,
        image_urls: list[str],
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        image_payloads = []
        for src in image_urls:
            if not src:
                continue
            image_payloads.append(await self._materialize_image(src))

        content: list[dict] = []
        for img in image_payloads:
            content.append({"image": img})
        content.append({"text": prompt})

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": [{"text": system_prompt}]})
        messages.append({"role": "user", "content": content})

        response = MultiModalConversation.call(
            api_key=self.api_key,
            model=self.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            result_format="message",
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Qwen-VL API error ({response.status_code}): {response.message}"
            )

        msg_content = response.output.choices[0].message.content
        # MultiModalConversation returns content as list of dicts: [{"text": "..."}]
        if isinstance(msg_content, list):
            return "".join(part.get("text", "") for part in msg_content if isinstance(part, dict))
        return str(msg_content)

    async def _materialize_image(self, src: str) -> str:
        """Turn a project image reference into something Qwen-VL accepts.

        - http(s):// URL → returned as-is
        - file://       → read locally, return data URL
        - anything else → treat as MinIO object key, download, return data URL
        """
        if src.startswith(("http://", "https://")):
            # If this is a presigned MinIO URL pointing at our local host,
            # DashScope still can't reach it. Heuristic: hosts containing
            # "minio" or matching the configured endpoint get inlined.
            parsed = urlparse(src)
            if self._is_local_minio_host(parsed.netloc):
                return await self._download_and_inline(src)
            return src

        if src.startswith("file://"):
            local_path = src[len("file://"):]
            return self._inline_local_file(local_path)

        # Treat as MinIO object key.
        return await self._download_and_inline_from_storage(src)

    @staticmethod
    def _is_local_minio_host(netloc: str) -> bool:
        if not netloc:
            return False
        ep = settings.MINIO_ENDPOINT.lower()
        host = netloc.lower()
        if host == ep or host.startswith(ep.split(":")[0]):
            return True
        return any(s in host for s in ("minio", "localhost", "127.0.0.1"))

    @staticmethod
    async def _download_and_inline(url: str) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            mime = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
            return _to_data_url(resp.content, mime)

    @staticmethod
    async def _download_and_inline_from_storage(object_key: str) -> str:
        url = await storage_service.get_presigned_url(object_key)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            mime = resp.headers.get("Content-Type") \
                or mimetypes.guess_type(object_key)[0] \
                or "image/jpeg"
            mime = mime.split(";")[0]
            return _to_data_url(resp.content, mime)

    @staticmethod
    def _inline_local_file(path: str) -> str:
        with open(path, "rb") as f:
            data = f.read()
        mime = mimetypes.guess_type(path)[0] or "image/jpeg"
        return _to_data_url(data, mime)


def _to_data_url(data: bytes, mime: str) -> str:
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"
