from app.services.ai.ali_video import AliVideoModel
from app.services.ai.base import BaseImageModel, BaseTextModel, BaseVideoModel, BaseVisionModel
from app.services.ai.model_registry import get_model
from app.services.ai.qwen import QwenModel
from app.services.ai.qwen_vl import QwenVLModel
from app.services.ai.tongyi_wanxiang import TongyiWanxiangModel
from app.services.ffmpeg import FFmpegService
from app.services.storage import storage_service
from app.services.tts import TTSService


def _credentials_for(provider: str, model_name: str) -> tuple[str | None, str | None]:
    """Look up (api_key, base_url) for a provider/model from the registry.

    Returns (None, None) when the registry has no entry — callers fall
    back to settings via the constructor's default.
    """
    entry = get_model(provider, model_name)
    if entry is None:
        return None, None
    return entry.api_key or None, entry.base_url


class ServiceContainer:
    def __init__(self):
        self._text_models: dict[str, BaseTextModel] = {}
        self._vision_models: dict[str, BaseVisionModel] = {}
        self._image_models: dict[str, BaseImageModel] = {}
        self._video_models: dict[str, BaseVideoModel] = {}
        self._tts: dict[str, TTSService] = {}
        self.storage = storage_service
        self.ffmpeg = FFmpegService()

    def invalidate(self) -> None:
        """Drop cached clients so they pick up freshly-edited credentials.

        Called after admin updates a provider's api_key/base_url.
        """
        self._text_models.clear()
        self._vision_models.clear()
        self._image_models.clear()
        self._video_models.clear()
        self._tts.clear()

    def get_text_model(self, provider: str = "qwen", model_name: str = "qwen-max") -> BaseTextModel:
        key = f"{provider}:{model_name}"
        if key not in self._text_models:
            api_key, base_url = _credentials_for(provider, model_name)
            if provider == "qwen":
                self._text_models[key] = QwenModel(
                    model_name=model_name, api_key=api_key, base_url=base_url
                )
            else:
                raise ValueError(f"Unknown text provider: {provider}")
        return self._text_models[key]

    def get_vision_model(self, provider: str = "qwen_vl", model_name: str = "qwen-vl-max") -> BaseVisionModel:
        key = f"{provider}:{model_name}"
        if key not in self._vision_models:
            api_key, base_url = _credentials_for(provider, model_name)
            if provider == "qwen_vl":
                self._vision_models[key] = QwenVLModel(
                    model_name=model_name, api_key=api_key, base_url=base_url
                )
            else:
                raise ValueError(f"Unknown vision provider: {provider}")
        return self._vision_models[key]

    def get_image_model(self, provider: str = "tongyi_wanxiang", model_name: str = "wanx-v1") -> BaseImageModel:
        key = f"{provider}:{model_name}"
        if key not in self._image_models:
            api_key, base_url = _credentials_for(provider, model_name)
            if provider == "tongyi_wanxiang":
                self._image_models[key] = TongyiWanxiangModel(
                    model_name=model_name, api_key=api_key, base_url=base_url
                )
            else:
                raise ValueError(f"Unknown image provider: {provider}")
        return self._image_models[key]

    def get_video_model(self, provider: str = "ali_video", model_name: str = "wan2.7-t2v") -> BaseVideoModel:
        key = f"{provider}:{model_name}"
        if key not in self._video_models:
            api_key, base_url = _credentials_for(provider, model_name)
            if provider == "ali_video":
                self._video_models[key] = AliVideoModel(
                    model_name=model_name, api_key=api_key, base_url=base_url
                )
            else:
                raise ValueError(f"Unknown video provider: {provider}")
        return self._video_models[key]

    def get_tts(self, provider: str = "dashscope_tts", model_name: str = "cosyvoice-v1") -> TTSService:
        key = f"{provider}:{model_name}"
        if key not in self._tts:
            api_key, _ = _credentials_for(provider, model_name)
            self._tts[key] = TTSService(api_key=api_key)
        return self._tts[key]

    @property
    def tts(self) -> TTSService:
        """Backwards-compatible default TTS instance."""
        return self.get_tts()


service_container = ServiceContainer()
