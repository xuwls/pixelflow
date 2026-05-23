import logging

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.project import MediaFile
from app.workflow.context import WorkflowContext
from app.workflow.nodes.base import BaseNodeHandler

logger = logging.getLogger(__name__)


class VideoGenerationHandler(BaseNodeHandler):
    node_type = "video_generation"
    node_label = "Video Generation"

    async def execute(self, context: WorkflowContext) -> dict:
        prompt_data = context.get_output("prompt") or {}
        keyframe_data = context.get_output("keyframe") or {}
        storyboard = context.get_output("storyboard") or {}
        scenes = prompt_data.get("scenes", [])
        keyframe_images = keyframe_data.get("images", [])
        storyboard_scenes = storyboard.get("scenes", [])
        config = (context.current_node.config_json or {}) if context.current_node else {}
        model_config = config.get("model", {})

        # use_reference_image switches reference-image behavior:
        #   true  → use keyframe as first frame when available
        #   false → ignore keyframes, generate purely from prompt
        use_reference_image = model_config.get("use_reference_image", True)

        from app.services.ai.model_registry import get_default_model
        default = get_default_model("视频编辑/生成")
        provider = model_config.get("provider") or (default.provider if default else "ali_video")
        model_name = model_config.get("model_name") or (default.model_name if default else "wan2.6-i2v-flash")
        width = config.get("width", 1080)
        height = config.get("height", 1920)

        video_model = context.services.get_video_model(provider, model_name)
        storage = context.services.storage
        videos = []
        debug_entries = []

        for i, scene in enumerate(scenes):
            scene_index = scene.get("scene_index", i + 1)
            video_prompt = scene.get("video_prompt", "")

            if not video_prompt:
                logger.warning(f"No video_prompt for scene {scene_index}, skipping")
                continue

            # Get reference image URL from keyframe
            # Prefer source_url (DashScope CDN accessible to video I2V API) over image_url (MinIO local)
            ref_image_url = None
            if use_reference_image:
                for img in keyframe_images:
                    if img.get("scene_index") == scene_index:
                        ref_image_url = img.get("source_url") or img.get("image_url")
                        if ref_image_url:
                            break

            # Get duration from storyboard
            duration = 4.0
            for sb in storyboard_scenes:
                if sb.get("scene_index") == scene_index:
                    duration = float(sb.get("duration", 4))
                    break

            import time as _time
            _t0 = _time.monotonic()
            try:
                result = await video_model.generate_video(
                    prompt=video_prompt,
                    image_url=ref_image_url,
                    duration_sec=duration,
                    width=width,
                    height=height,
                )
                _duration_ms = int((_time.monotonic() - _t0) * 1000)

                debug_entries.append({
                    "scene_index": scene_index,
                    "input": {
                        "provider": provider,
                        "model_name": model_name,
                        "prompt": video_prompt,
                        "image_url": ref_image_url,
                        "duration_sec": duration,
                        "width": width,
                        "height": height,
                    },
                    "output": {
                        "url": result.url,
                        "task_id": result.task_id,
                        "duration_sec": result.duration_sec,
                    },
                    "duration_ms": _duration_ms,
                })

                object_key = f"projects/{context.project.id}/videos/scene_{scene_index:02d}.mp4"
                local_path = await context.services.ffmpeg.download_to_work_dir(result.url)

                await storage.upload_file(object_key, local_path, "video/mp4")

                async with async_session_factory() as db:
                    media = MediaFile(
                        project_id=context.project.id,
                        node_id=context.current_node.id if context.current_node else None,
                        file_type="video_clip",
                        file_name=f"scene_{scene_index:02d}.mp4",
                        file_url=object_key,
                        mime_type="video/mp4",
                        scene_index=scene_index,
                    )
                    db.add(media)
                    await db.commit()

                presigned_url = await storage.get_presigned_url(object_key)
                videos.append({
                    "scene_index": scene_index,
                    "video_url": presigned_url,
                    "object_key": object_key,
                    "duration": result.duration_sec,
                })
                logger.info(f"Generated video for scene {scene_index}")

            except Exception as e:
                logger.error(f"Failed to generate video for scene {scene_index}: {e}")
                debug_entries.append({
                    "scene_index": scene_index,
                    "input": {
                        "provider": provider,
                        "model_name": model_name,
                        "prompt": video_prompt,
                        "image_url": ref_image_url,
                        "duration_sec": duration,
                        "width": width,
                        "height": height,
                    },
                    "output": {"error": str(e)},
                    "duration_ms": int((_time.monotonic() - _t0) * 1000),
                })
                videos.append({
                    "scene_index": scene_index,
                    "video_url": "",
                    "object_key": "",
                    "duration": 0,
                    "error": str(e),
                })

        if context.current_node:
            context.current_node.debug_log = {
                "total_calls": len(debug_entries),
                "calls": debug_entries,
            }

        return {"videos": videos, "total_generated": len([v for v in videos if v.get("video_url")])}
