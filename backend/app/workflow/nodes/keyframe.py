import logging

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.project import MediaFile
from app.services.ai.model_registry import get_default_model
from app.workflow.context import WorkflowContext
from app.workflow.nodes.base import BaseNodeHandler

logger = logging.getLogger(__name__)


class KeyframeHandler(BaseNodeHandler):
    node_type = "keyframe"
    node_label = "Keyframe Generation"

    async def execute(self, context: WorkflowContext) -> dict:
        prompt_data = context.get_output("prompt") or {}
        scenes = prompt_data.get("scenes", [])
        config = (context.current_node.config_json or {}) if context.current_node else {}
        model_config = config.get("model", {})

        # Capability defaults to 图片编辑/生成
        capability = (model_config.get("capability") or "图片编辑/生成")

        default = get_default_model("图片编辑/生成")
        provider = model_config.get("provider") or (default.provider if default else "tongyi_wanxiang")
        model_name = model_config.get("model_name") or (default.model_name if default else "wanx-v1")
        width = config.get("width", 1080)
        height = config.get("height", 1920)

        image_model = context.services.get_image_model(provider, model_name)
        storage = context.services.storage
        images = []
        debug_entries = []
        skipped_entries = []

        # Visibility for the "scenes is empty / wrong shape" failure mode.
        # Before this, an empty `scenes` left debug_log.calls=[] with no clue
        # why the loop body never ran.
        if not scenes:
            logger.warning(
                "Keyframe: prompt_data has no scenes (keys=%s, type=%s, len=%s)",
                list(prompt_data.keys()) if isinstance(prompt_data, dict) else None,
                type(prompt_data).__name__,
                len(prompt_data) if hasattr(prompt_data, "__len__") else "n/a",
            )

        for scene in scenes:
            image_prompt = scene.get("image_prompt", "")
            scene_index = scene.get("scene_index", 0)

            if not image_prompt:
                logger.warning(f"No image_prompt for scene {scene_index}, skipping")
                skipped_entries.append({
                    "scene_index": scene_index,
                    "reason": "missing image_prompt",
                    "scene_keys": list(scene.keys()) if isinstance(scene, dict) else None,
                })
                continue

            import time as _time
            _t0 = _time.monotonic()
            try:
                results = await image_model.generate_image(
                    prompt=image_prompt,
                    width=width,
                    height=height,
                    num_images=1,
                )
                _duration_ms = int((_time.monotonic() - _t0) * 1000)

                _input_record = {
                    "provider": provider,
                    "model_name": model_name,
                    "prompt": image_prompt,
                    "width": width,
                    "height": height,
                    "num_images": 1,
                }

                if not results:
                    logger.warning(
                        f"No image generated for scene {scene_index} (provider={provider}, model={model_name}) — API returned empty results"
                    )
                    debug_entries.append({
                        "scene_index": scene_index,
                        "input": _input_record,
                        "output": {"error": "API returned empty results (no error raised)"},
                        "duration_ms": _duration_ms,
                    })
                    images.append({
                        "scene_index": scene_index,
                        "image_url": "",
                        "object_key": "",
                        "error": f"{provider}/{model_name} returned empty results",
                    })
                    continue

                result = results[0]

                debug_entries.append({
                    "scene_index": scene_index,
                    "input": _input_record,
                    "output": {"url": result.url, "seed": result.seed},
                    "duration_ms": _duration_ms,
                })

                object_key = f"projects/{context.project.id}/keyframes/scene_{scene_index:02d}.png"
                local_path = await context.services.ffmpeg.download_to_work_dir(result.url)

                await storage.upload_file(object_key, local_path, "image/png")

                async with async_session_factory() as db:
                    media = MediaFile(
                        project_id=context.project.id,
                        node_id=context.current_node.id if context.current_node else None,
                        file_type="keyframe",
                        file_name=f"scene_{scene_index:02d}.png",
                        file_url=object_key,
                        mime_type="image/png",
                        scene_index=scene_index,
                    )
                    db.add(media)
                    await db.commit()

                presigned_url = await storage.get_presigned_url(object_key)
                images.append({
                    "scene_index": scene_index,
                    "image_url": presigned_url,
                    "source_url": result.url,  # DashScope CDN URL, accessible to video I2V API
                    "object_key": object_key,
                })
                logger.info(f"Generated keyframe for scene {scene_index}")

            except Exception as e:
                logger.error(f"Failed to generate keyframe for scene {scene_index}: {e}")
                debug_entries.append({
                    "scene_index": scene_index,
                    "input": {
                        "provider": provider,
                        "model_name": model_name,
                        "prompt": image_prompt,
                        "width": width,
                        "height": height,
                        "num_images": 1,
                    },
                    "output": {"error": str(e)},
                    "duration_ms": int((_time.monotonic() - _t0) * 1000),
                })
                images.append({
                    "scene_index": scene_index,
                    "image_url": "",
                    "object_key": "",
                    "error": str(e),
                })

        if context.current_node:
            context.current_node.debug_log = {
                "total_calls": len(debug_entries),
                "calls": debug_entries,
                "skipped": skipped_entries,
                "prompt_data_summary": {
                    "type": type(prompt_data).__name__,
                    "keys": list(prompt_data.keys()) if isinstance(prompt_data, dict) else None,
                    "scene_count": len(scenes) if hasattr(scenes, "__len__") else None,
                },
                "config": {
                    "provider": provider,
                    "model_name": model_name,
                    "width": width,
                    "height": height,
                },
            }

        return {"images": images, "total_generated": len([i for i in images if i.get("image_url")])}
