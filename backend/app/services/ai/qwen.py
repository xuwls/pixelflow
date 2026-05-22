from typing import Optional

from dashscope import Generation
from dashscope.api_entities.dashscope_response import GenerationResponse

from app.config import settings
from app.services.ai.base import BaseTextModel


class QwenModel(BaseTextModel):
    provider = "qwen"

    def __init__(
        self,
        model_name: str = "qwen-max",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.DASHSCOPE_API_KEY
        self.base_url = base_url
        self.model_name = model_name

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response: GenerationResponse = Generation.call(
            api_key=self.api_key,
            model=self.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            result_format="message",
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Qwen API error ({response.status_code}): {response.message}"
            )

        return response.output.choices[0].message.content
