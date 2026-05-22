import asyncio
import logging
import time

import httpx

from app.config import settings
from app.services.ai.base import BaseVideoModel, VideoResult

logger = logging.getLogger(__name__)

DASHSCOPE_T2V_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
DASHSCOPE_I2V_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis"

# Wan 2.5/2.6 I2V models: use unified /video-generation/ endpoint with input.img_url
# + parameters.resolution (per official docs). wan2.7-i2v uses an input.media array
# instead — schema not yet confirmed, so we don't auto-select it as default.
# Legacy models (wan2.2-kf2v-flash, wanx2.1-i2v-*) use the separate /image2video/ endpoint
# with input.first_frame_url + parameters.size.
UNIFIED_I2V_MODELS = {
    "wan2.6-i2v-flash", "wan2.6-i2v", "wan2.6-i2v-us", "wan2.5-i2v-preview",
}
LEGACY_I2V_MODELS = {"wan2.2-kf2v-flash", "wanx2.1-i2v-turbo", "wanx2.1-i2v-plus"}
I2V_MODELS = UNIFIED_I2V_MODELS | LEGACY_I2V_MODELS

T2V_MODELS = {"wan2.7-t2v", "wan2.6-t2v", "wan2.5-t2v-preview", "wan2.2-t2v-plus", "wanx2.1-t2v-turbo", "wanx2.1-t2v-plus"}

DEFAULT_I2V_MODEL = "wan2.6-i2v-flash"


class AliVideoModel(BaseVideoModel):
    provider = "ali_video"

    def __init__(
        self,
        model_name: str = "wan2.7-t2v",
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key if api_key is not None else settings.DASHSCOPE_API_KEY
        self.base_url = base_url
        self.model_name = model_name if model_name else "wan2.7-t2v"

    async def generate_video(
        self,
        prompt: str,
        image_url: str | None = None,
        duration_sec: float = 5.0,
        width: int = 1080,
        height: int = 1920,
    ) -> VideoResult:
        if not self.api_key or self.api_key.startswith("http"):
            logger.warning("No valid DashScope API key, returning placeholder")
            return VideoResult(
                url=f"placeholder://video/{hash(prompt) & 0xFFFFFFFF}.mp4",
                duration_sec=duration_sec,
                width=width,
                height=height,
                task_id=f"placeholder_{hash(prompt) & 0xFFFFFFFF}",
            )

        is_i2v = bool(image_url)
        model = self.model_name

        # Auto-select correct model
        if is_i2v and model not in I2V_MODELS:
            model = DEFAULT_I2V_MODEL
        elif not is_i2v and model not in T2V_MODELS:
            model = "wan2.7-t2v"

        # Wan 2.7 I2V uses the unified T2V endpoint; legacy models use the I2V endpoint
        if is_i2v and model in LEGACY_I2V_MODELS:
            endpoint = DASHSCOPE_I2V_API
        else:
            endpoint = DASHSCOPE_T2V_API

        async with httpx.AsyncClient(timeout=60.0) as client:
            input_data: dict = {"prompt": prompt}
            if image_url:
                if model in LEGACY_I2V_MODELS:
                    # Legacy wanx2.1-i2v / wan2.2-kf2v use first_frame_url.
                    input_data["first_frame_url"] = image_url
                else:
                    # wan2.5/2.6 i2v family takes input.img_url (single string),
                    # per official docs:
                    #   https://help.aliyun.com/zh/model-studio/image-to-video-api-reference
                    input_data["img_url"] = image_url

            parameters: dict = {"duration": int(duration_sec)}
            # wan2.x series uses parameters.resolution ("720P"/"1080P")
            # while legacy wanx-* uses parameters.size ("WxH" with '*').
            # Mixing them causes "Field required: input.media" on wan2.7
            # because the validator treats unknown params as a different
            # request shape.
            is_wan2x = model.startswith(("wan2.5", "wan2.6", "wan2.7"))
            if is_wan2x:
                long_side = max(width, height)
                if long_side >= 1920:
                    parameters["resolution"] = "1080P"
                else:
                    parameters["resolution"] = "720P"
            else:
                parameters["size"] = f"{width}*{height}"

            payload: dict = {
                "model": model,
                "input": input_data,
                "parameters": parameters,
            }

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "X-DashScope-Async": "enable",
            }

            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Video gen API error ({resp.status_code}) "
                    f"model={model} endpoint={endpoint} payload={payload} "
                    f"response={resp.text[:500]}"
                )

            data = resp.json()

            if "output" not in data or "task_id" not in data["output"]:
                raise RuntimeError(f"Video gen API unexpected response: {data}")

            task_id = data["output"]["task_id"]

            video_url = await self._poll_task(client, task_id, headers)

            return VideoResult(
                url=video_url,
                duration_sec=duration_sec,
                width=width,
                height=height,
                task_id=task_id,
            )

    async def _poll_task(self, client: httpx.AsyncClient, task_id: str, headers: dict) -> str:
        task_url = f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
        max_attempts = 120  # 10 minutes at 5s intervals
        for attempt in range(max_attempts):
            await asyncio.sleep(5)
            resp = await client.get(task_url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            status = data.get("output", {}).get("task_status", "")
            if status == "SUCCEEDED":
                results = data.get("output", {}).get("results", [])
                if results and results[0].get("url"):
                    return results[0]["url"]
                # Some DashScope models put the URL elsewhere on success.
                # Surface the full output payload so we can adapt the parser
                # rather than failing with a context-free error.
                output_blob = data.get("output", {})
                video_url = output_blob.get("video_url") or output_blob.get("url")
                if video_url:
                    return video_url
                logger.error(
                    "Video task %s SUCCEEDED but no URL in response: %s",
                    task_id, data,
                )
                raise RuntimeError(
                    f"Video task succeeded but no URL returned. Full output: {output_blob}"
                )
            elif status == "FAILED":
                raise RuntimeError(f"Video gen task failed: {data.get('output', {}).get('message', '')}")
            elif status in ("PENDING", "RUNNING"):
                logger.info(f"Video task {task_id} status: {status} (attempt {attempt + 1})")
                continue
            else:
                raise RuntimeError(f"Unknown video task status: {status}")

        raise TimeoutError(f"Video generation timed out for task {task_id}")

    async def get_task_status(self, task_id: str) -> str:
        if task_id.startswith("placeholder_"):
            return "completed"

        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            resp = await client.get(
                f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("output", {}).get("task_status", "UNKNOWN").lower()
