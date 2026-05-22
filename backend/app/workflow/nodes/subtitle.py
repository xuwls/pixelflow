import logging
import tempfile

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.project import MediaFile
from app.workflow.context import WorkflowContext
from app.workflow.nodes.base import BaseNodeHandler

logger = logging.getLogger(__name__)


class SubtitleHandler(BaseNodeHandler):
    node_type = "subtitle"
    node_label = "Subtitle"

    async def execute(self, context: WorkflowContext) -> dict:
        storyboard = context.get_output("storyboard") or {}
        scenes = storyboard.get("scenes", [])
        srt_lines = []
        start_time = 0.0

        for i, s in enumerate(scenes):
            dur = float(s.get("duration", 4))
            end_time = start_time + dur
            srt_lines.append(f"{i + 1}")
            srt_lines.append(f"{self._fmt_time(start_time)} --> {self._fmt_time(end_time)}")
            srt_lines.append(s.get("subtitle", ""))
            srt_lines.append("")
            start_time = end_time

        srt_content = "\n".join(srt_lines)
        object_key = f"projects/{context.project.id}/subtitles/subtitle.srt"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False, encoding="utf-8") as f:
            f.write(srt_content)
            tmp_path = f.name

        try:
            await context.services.storage.upload_file(object_key, tmp_path, "text/plain")

            async with async_session_factory() as db:
                media = MediaFile(
                    project_id=context.project.id,
                    node_id=context.current_node.id if context.current_node else None,
                    file_type="subtitle",
                    file_name="subtitle.srt",
                    file_url=object_key,
                    mime_type="text/plain",
                )
                db.add(media)
                await db.commit()

            presigned_url = await context.services.storage.get_presigned_url(object_key)
            return {"srt_content": srt_content, "srt_url": presigned_url, "object_key": object_key}
        finally:
            import os
            os.unlink(tmp_path)

    @staticmethod
    def _fmt_time(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
