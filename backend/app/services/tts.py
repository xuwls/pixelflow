import logging

import dashscope
from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key if api_key is not None else settings.DASHSCOPE_API_KEY

    def generate_speech(
        self,
        text: str,
        voice: str = "longxiaochun",
        speed: float = 1.0,
    ) -> bytes:
        if not self.api_key or self.api_key.startswith("http"):
            logger.warning("No valid DashScope API key configured, TTS will use placeholder")
            return b""

        # New tts_v2 SDK reads the api key from the dashscope module global
        # rather than accepting api_key= on the call. Set it before instantiating.
        dashscope.api_key = self.api_key

        synthesizer = SpeechSynthesizer(
            model="cosyvoice-v1",
            voice=voice,
            format=AudioFormat.MP3_22050HZ_MONO_256KBPS,
            speech_rate=float(speed),
        )

        audio_bytes = synthesizer.call(text)
        if not audio_bytes:
            request_id = synthesizer.get_last_request_id()
            response = synthesizer.get_response()
            raise RuntimeError(
                f"TTS returned no audio data (model=cosyvoice-v1, voice={voice}, "
                f"text_len={len(text)}, request_id={request_id}, response={response})"
            )
        return audio_bytes
