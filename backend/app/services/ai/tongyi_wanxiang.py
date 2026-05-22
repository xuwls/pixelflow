import logging

from dashscope import ImageSynthesis

from app.config import settings
from app.services.ai.base import BaseImageModel, ImageResult

logger = logging.getLogger(__name__)

# DashScope wanx-* models only accept a fixed set of sizes. Passing an
# unsupported size returns HTTP 200 with an empty results list (no error
# raised), which is exactly the failure mode we hit on project 16.
# Reference: https://help.aliyun.com/zh/model-studio/text-to-image-v1-api
_WANX_V1_SIZES = {(1024, 1024), (720, 1280), (1280, 720)}
_WANX2_SIZES = {
    (1024, 1024), (720, 1280), (1280, 720),
    (768, 1152), (1152, 768),
}


def _snap_to_supported_size(model_name: str, width: int, height: int) -> tuple[int, int]:
    """Snap (width,height) to the nearest supported size for the model.

    For portrait-ish requests (h>w) we always pick a portrait supported size,
    and vice versa, so the aspect ratio category is preserved.
    """
    if model_name == "wanx-v1":
        candidates = _WANX_V1_SIZES
    elif model_name.startswith("wanx2"):
        candidates = _WANX2_SIZES
    else:
        # Unknown model: return as-is and let the API decide.
        return width, height

    if (width, height) in candidates:
        return width, height

    is_portrait = height > width
    filtered = [(w, h) for (w, h) in candidates if (h > w) == is_portrait]
    if not filtered:
        filtered = list(candidates)

    target_ratio = width / height
    best = min(filtered, key=lambda wh: abs(wh[0] / wh[1] - target_ratio))
    return best


class TongyiWanxiangModel(BaseImageModel):
    provider = "tongyi_wanxiang"

    def __init__(
        self,
        model_name: str = "wanx-v1",
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key if api_key is not None else settings.DASHSCOPE_API_KEY
        self.base_url = base_url
        self.model_name = model_name

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str | None = None,
        width: int = 1024,
        height: int = 1024,
        num_images: int = 1,
        seed: int | None = None,
    ) -> list[ImageResult]:
        # Snap to a supported size for this model — wanx-v1 silently returns
        # empty results when given e.g. 1080*1920.
        actual_w, actual_h = _snap_to_supported_size(self.model_name, width, height)
        if (actual_w, actual_h) != (width, height):
            logger.info(
                "Tongyi Wanxiang: snapping size %sx%s → %sx%s for model %s",
                width, height, actual_w, actual_h, self.model_name,
            )

        kwargs = {
            "api_key": self.api_key,
            "model": self.model_name,
            "prompt": prompt,
            "n": num_images,
            "size": f"{actual_w}*{actual_h}",
        }
        if negative_prompt:
            kwargs["negative_prompt"] = negative_prompt
        if seed is not None:
            kwargs["seed"] = seed

        response = ImageSynthesis.call(**kwargs)

        if response.status_code != 200:
            raise RuntimeError(
                f"Tongyi Wanxiang API error ({response.status_code}): {response.message}"
            )

        # Even with status 200 the API can return an empty results list when
        # the request is silently rejected (unsupported size, content policy,
        # quota). Surface the full response payload so the caller's debug_log
        # actually shows *why*.
        raw_results = getattr(response.output, "results", None) or []
        if not raw_results:
            output_repr = getattr(response, "output", None)
            request_id = getattr(response, "request_id", None)
            code = getattr(response, "code", None)
            message = getattr(response, "message", None)
            raise RuntimeError(
                f"Tongyi Wanxiang returned 200 with no images "
                f"(model={self.model_name}, size={actual_w}*{actual_h}, "
                f"request_id={request_id}, code={code}, message={message}, output={output_repr})"
            )

        results = []
        for img_result in raw_results:
            results.append(
                ImageResult(
                    url=img_result.url,
                    width=actual_w,
                    height=actual_h,
                    seed=seed,
                )
            )
        return results
