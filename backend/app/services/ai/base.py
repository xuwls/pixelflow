from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ImageResult:
    url: str
    width: int
    height: int
    seed: int | None = None


@dataclass
class VideoResult:
    url: str
    duration_sec: float
    width: int
    height: int
    task_id: str | None = None


class BaseTextModel(ABC):
    provider: str

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        ...


class BaseVisionModel(ABC):
    """Vision-language model: takes one or more images plus text, returns text."""

    provider: str

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        image_urls: list[str],
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        ...


class BaseImageModel(ABC):
    provider: str

    @abstractmethod
    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str | None = None,
        width: int = 1024,
        height: int = 1024,
        num_images: int = 1,
        seed: int | None = None,
    ) -> list[ImageResult]:
        ...


class BaseVideoModel(ABC):
    provider: str

    @abstractmethod
    async def generate_video(
        self,
        prompt: str,
        image_url: str | None = None,
        duration_sec: float = 5.0,
        width: int = 1080,
        height: int = 1920,
    ) -> VideoResult:
        ...

    @abstractmethod
    async def get_task_status(self, task_id: str) -> str:
        ...
