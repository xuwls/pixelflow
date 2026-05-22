import logging
import os
import tempfile

from app.core.database import async_session_factory
from app.models.project import MediaFile
from app.workflow.context import WorkflowContext
from app.config import settings
from app.workflow.nodes.base import BaseNodeHandler

logger = logging.getLogger(__name__)


class VideoCompositionHandler(BaseNodeHandler):
    node_type = "video_composition"
    node_label = "Video Composition"

    async def execute(self, context: WorkflowContext) -> dict:
        video_data = context.get_output("video_generation") or {}
        keyframe_data = context.get_output("keyframe") or {}
        storyboard_data = context.get_output("storyboard") or {}
        subtitle_data = context.get_output("subtitle") or {}
        voiceover_data = context.get_output("voiceover") or {}
        config = (context.current_node.config_json or {}) if context.current_node else {}
        width = int(config.get("width", 1080))
        height = int(config.get("height", 1920))
        fps = int(config.get("fps", 30))

        storage = context.services.storage
        ffmpeg_svc = context.services.ffmpeg
        videos = video_data.get("videos", [])
        keyframe_images = keyframe_data.get("images", [])
        storyboard_scenes = storyboard_data.get("scenes", [])

        run_dir = ffmpeg_svc.work_dir / f"compose_{context.project.id}"
        run_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Download video clips (or generate from keyframe if no video)
            local_clips = []
            for v in sorted(videos, key=lambda x: x.get("scene_index", 0)):
                scene_index = v.get("scene_index", 0)
                if v.get("video_url"):
                    local_path = str(run_dir / f"clip_{scene_index:02d}.mp4")
                    try:
                        # Download from URL (already presigned)
                        dl_path = await ffmpeg_svc.download_to_work_dir(v["video_url"])
                        os.rename(dl_path, local_path)
                        local_clips.append(local_path)
                    except Exception as e:
                        logger.warning(f"Failed to download video for scene {scene_index}: {e}")
                        # Fallback: create still frame from keyframe
                        local_clips.append(
                            await self._create_still_clip(
                                ffmpeg_svc, keyframe_images, storyboard_scenes,
                                scene_index, run_dir
                            )
                        )
                else:
                    local_clips.append(
                        await self._create_still_clip(
                            ffmpeg_svc, keyframe_images, storyboard_scenes,
                            scene_index, run_dir
                        )
                    )

            if not local_clips:
                raise ValueError("No video clips to compose")

            # Download subtitle
            local_srt = str(run_dir / "subtitle.srt")
            srt_key = subtitle_data.get("object_key", "")
            if srt_key:
                await storage.download_file(srt_key, local_srt)
            else:
                # Write inline SRT if available
                srt_content = subtitle_data.get("srt_content", "")
                if srt_content:
                    with open(local_srt, "w", encoding="utf-8") as f:
                        f.write(srt_content)

            # Download voiceover
            local_voiceover = str(run_dir / "voiceover.mp3")
            vo_key = voiceover_data.get("object_key", "")
            if vo_key:
                await storage.download_file(vo_key, local_voiceover)

            # Compose
            output_local = str(run_dir / "output.mp4")
            await ffmpeg_svc.compose_video(
                video_clips=local_clips,
                srt_path=local_srt,
                voiceover_path=local_voiceover,
                output_path=output_local,
                width=width,
                height=height,
                fps=fps,
            )

            # Upload final video
            final_key = f"projects/{context.project.id}/exports/output.mp4"
            await storage.upload_file(final_key, output_local, "video/mp4")

            async with async_session_factory() as db:
                media = MediaFile(
                    project_id=context.project.id,
                    node_id=context.current_node.id if context.current_node else None,
                    file_type="final_video",
                    file_name="output.mp4",
                    file_url=final_key,
                    mime_type="video/mp4",
                )
                db.add(media)
                await db.commit()

            presigned_url = await storage.get_presigned_url(final_key)
            return {
                "final_video_url": presigned_url,
                "object_key": final_key,
                "resolution": f"{width}x{height}",
                "format": "mp4",
            }

        except Exception as e:
            logger.exception(f"Video composition failed: {e}")
            raise
        finally:
            import shutil
            shutil.rmtree(run_dir, ignore_errors=True)

    async def _create_still_clip(
        self, ffmpeg_svc, keyframe_images, storyboard_scenes, scene_index, run_dir
    ) -> str:
        """Create a still-frame video clip from a keyframe image."""
        output_path = str(run_dir / f"clip_{scene_index:02d}_still.mp4")
        duration = 4.0
        for sb in storyboard_scenes:
            if sb.get("scene_index") == scene_index:
                duration = float(sb.get("duration", 4))
                break

        # Find matching keyframe
        for img in keyframe_images:
            if img.get("scene_index") == scene_index and img.get("image_url"):
                dl_path = await ffmpeg_svc.download_to_work_dir(img["image_url"])
                os.rename(dl_path, str(run_dir / f"keyframe_{scene_index:02d}.png"))
                image_path = str(run_dir / f"keyframe_{scene_index:02d}.png")
                await ffmpeg_svc.create_silent_video_from_image(image_path, duration, output_path)
                return output_path

        # No keyframe available, create black video
        cmd = [
            settings.FFMPEG_BIN, "-y",
            "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:d={duration}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            output_path,
        ]
        import asyncio
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            raise FileNotFoundError(
                f"FFmpeg binary not found at '{settings.FFMPEG_BIN}'. "
                f"Set FFMPEG_BIN in .env to the full path of ffmpeg.exe."
            )
        await process.communicate()
        return output_path
