import logging
import tempfile

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.project import MediaFile
from app.workflow.context import WorkflowContext
from app.workflow.nodes.base import BaseNodeHandler

logger = logging.getLogger(__name__)


class VoiceoverHandler(BaseNodeHandler):
    node_type = "voiceover"
    node_label = "Voiceover"

    async def execute(self, context: WorkflowContext) -> dict:
        script = context.get_output("script") or {}
        script_scenes = script.get("scenes", [])
        config = (context.current_node.config_json or {}) if context.current_node else {}
        voice = config.get("voice", "longxiaochun")
        speed = float(config.get("speed", 1.0))

        # Build full narration text from script scenes
        narration_parts = []
        for s in script_scenes:
            narration = s.get("narration", "")
            if narration:
                narration_parts.append(narration)
        full_text = " ".join(narration_parts)

        if not full_text:
            logger.warning("No narration text found for TTS")
            return {"audio_url": "", "object_key": "", "duration_sec": 0}

        try:
            import time as _time
            _t0 = _time.monotonic()
            audio_bytes = context.services.tts.generate_speech(
                text=full_text,
                voice=voice,
                speed=speed,
            )
            _duration_ms = int((_time.monotonic() - _t0) * 1000)

            if context.current_node:
                context.current_node.debug_log = {
                    "input": {
                        "text": full_text,
                        "voice": voice,
                        "speed": speed,
                        "model": "cosyvoice-v1",
                    },
                    "output": {
                        "audio_size_bytes": len(audio_bytes) if audio_bytes else 0,
                    },
                    "duration_ms": _duration_ms,
                }

            if not audio_bytes:
                # Refuse to upload a 0-byte mp3: it would silently break
                # the downstream video_composition ffmpeg call with a cryptic
                # "Invalid data found when processing input" error.
                raise RuntimeError(
                    f"TTS produced 0-byte audio for text of length {len(full_text)} "
                    f"(voice={voice}, speed={speed}). Aborting voiceover node."
                )

            object_key = f"projects/{context.project.id}/audio/voiceover.mp3"

            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name

            try:
                await context.services.storage.upload_file(object_key, tmp_path, "audio/mpeg")

                async with async_session_factory() as db:
                    media = MediaFile(
                        project_id=context.project.id,
                        node_id=context.current_node.id if context.current_node else None,
                        file_type="voiceover",
                        file_name="voiceover.mp3",
                        file_url=object_key,
                        mime_type="audio/mpeg",
                    )
                    db.add(media)
                    await db.commit()

                presigned_url = await context.services.storage.get_presigned_url(object_key)
                return {
                    "audio_url": presigned_url,
                    "object_key": object_key,
                    "duration_sec": len(full_text) * 0.3,
                    "format": "mp3",
                }
            finally:
                import os
                os.unlink(tmp_path)

        except Exception as e:
            logger.exception(f"Voiceover generation failed: {e}")
            # Re-raise so the executor marks this node and the run as failed.
            # Previously this returned a fake "success" with empty audio_url,
            # which silently propagated a 0-byte mp3 to video_composition.
            if context.current_node and not context.current_node.debug_log:
                context.current_node.debug_log = {
                    "input": {"text": full_text, "voice": voice, "speed": speed},
                    "output": {"error": str(e)},
                }
            raise
