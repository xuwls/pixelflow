"""Single-node executor.

Replaces the old fixed-pipeline `WorkflowExecutor`. Each node is executed
on its own — input comes from edges in `workflow_edge`, kind decides
which AI capability to call, model is picked from the node's
config_json.model.{provider,model_name}.

Output shape (written to `WorkflowNode.output_json`):
    text  → {"text": "..."}
    image → {"images": [{"url": ..., "width": w, "height": h}, ...]}
    video → {"videos": [{"url": ..., "width": w, "height": h}], "task_id": ...}
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.core.websocket_manager import websocket_manager
from app.models.project import MediaFile, Project, WorkflowEdge, WorkflowNode, WorkflowRun
from app.services.ai.model_registry import (
    Capability,
    get_default_model,
    get_model,
    reload_registry,
)
from app.services.service_container import service_container
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


KIND_TO_CAPABILITY: dict[str, Capability] = {
    "text": "文字编辑/生成",
    "image": "图片编辑/生成",
    "video": "视频编辑/生成",
}


class NodeExecutionError(RuntimeError):
    pass


class NodeExecutor:
    def __init__(
        self,
        project_id: int,
        node_id: int,
        celery_task_id: str | None = None,
    ):
        self.project_id = project_id
        self.node_id = node_id
        self.celery_task_id = celery_task_id

    async def execute(self) -> int:
        async with async_session_factory() as db:
            # Celery worker is a separate process — it didn't see the
            # FastAPI lifespan reload, so refresh the catalog now.
            await reload_registry(db)
            service_container.invalidate()

            project = (
                await db.execute(select(Project).where(Project.id == self.project_id))
            ).scalar_one_or_none()
            node = (
                await db.execute(
                    select(WorkflowNode).where(
                        WorkflowNode.id == self.node_id,
                        WorkflowNode.project_id == self.project_id,
                    )
                )
            ).scalar_one_or_none()
            if project is None or node is None:
                raise NodeExecutionError(
                    f"Node {self.node_id} or project {self.project_id} missing"
                )

            run = None
            if self.celery_task_id:
                run_result = await db.execute(
                    select(WorkflowRun).where(
                        WorkflowRun.celery_task_id == self.celery_task_id
                    )
                )
                run = run_result.scalar_one_or_none()

            try:
                upstream = await self._collect_upstream(db, node)
                output = await self._dispatch(node, upstream)

                node.output_json = output
                node.status = "completed"
                node.completed_at = datetime.now(timezone.utc)
                node.error_message = None

                if run:
                    run.status = "completed"
                    run.completed_at = datetime.now(timezone.utc)

                # Project status is just "are any nodes still running?"
                project.status = "draft" if not await self._any_running(db, project.id, node.id) else "processing"

                await db.commit()
                await self._broadcast(node)
            except Exception as exc:
                logger.exception("Node %s failed: %s", node.id, exc)
                node.status = "failed"
                node.error_message = str(exc)
                node.completed_at = datetime.now(timezone.utc)
                if run:
                    run.status = "failed"
                    run.completed_at = datetime.now(timezone.utc)
                project.status = "draft" if not await self._any_running(db, project.id, node.id) else "processing"
                await db.commit()
                await self._broadcast(node)

            return run.id if run else 0

    # ── upstream collection ───────────────────────────────────────────

    async def _collect_upstream(
        self, db: AsyncSession, node: WorkflowNode
    ) -> list[WorkflowNode]:
        edge_result = await db.execute(
            select(WorkflowEdge).where(WorkflowEdge.target_node_id == node.id)
        )
        source_ids = [e.source_node_id for e in edge_result.scalars()]
        if not source_ids:
            return []
        result = await db.execute(
            select(WorkflowNode).where(WorkflowNode.id.in_(source_ids))
        )
        return list(result.scalars())

    # ── dispatch by kind ──────────────────────────────────────────────

    async def _dispatch(
        self, node: WorkflowNode, upstream: list[WorkflowNode]
    ) -> dict[str, Any]:
        if node.kind not in KIND_TO_CAPABILITY:
            raise NodeExecutionError(f"Unknown node kind: {node.kind}")

        provider, model_name = self._resolve_model(node)

        prompt = (node.prompt or "").strip()
        if not prompt:
            raise NodeExecutionError("Prompt is empty")

        rendered = self._render_prompt(prompt, upstream)
        image_refs = self._collect_image_refs(upstream)
        video_refs = self._collect_video_refs(upstream)

        if node.kind == "text":
            return await self._run_text(rendered, image_refs, provider, model_name, node)
        if node.kind == "image":
            return await self._run_image(rendered, provider, model_name, node)
        if node.kind == "video":
            first_frame = image_refs[0] if image_refs else (video_refs[0] if video_refs else None)
            return await self._run_video(rendered, first_frame, provider, model_name, node)
        raise NodeExecutionError(f"Unhandled kind: {node.kind}")

    def _resolve_model(self, node: WorkflowNode) -> tuple[str, str]:
        capability = KIND_TO_CAPABILITY[node.kind]
        cfg = (node.config_json or {}).get("model") or {}
        provider = cfg.get("provider")
        model_name = cfg.get("model_name")
        if provider and model_name and get_model(provider, model_name):
            return provider, model_name
        default = get_default_model(capability)
        if default is None:
            raise NodeExecutionError(
                f"No model configured for capability '{capability}' — "
                f"add one in admin or set node.config_json.model"
            )
        return default.provider, default.model_name

    @staticmethod
    def _render_prompt(prompt: str, upstream: list[WorkflowNode]) -> str:
        """Append upstream text-output context so the LLM sees it.

        We never silently mutate the user's prompt — we tack the upstream
        context on as a clearly labelled block underneath. Image/video
        upstreams are passed via the multimodal path instead.
        """
        text_chunks: list[str] = []
        for u in upstream:
            if u.kind == "text" and u.output_json:
                txt = u.output_json.get("text") if isinstance(u.output_json, dict) else None
                if isinstance(txt, str) and txt.strip():
                    label = u.title or f"#{u.id}"
                    text_chunks.append(f"### {label}\n{txt.strip()}")
        if not text_chunks:
            return prompt
        return f"{prompt}\n\n## Upstream context\n" + "\n\n".join(text_chunks)

    @staticmethod
    def _collect_image_refs(upstream: list[WorkflowNode]) -> list[str]:
        refs: list[str] = []
        for u in upstream:
            if u.kind != "image" or not u.output_json:
                continue
            out = u.output_json
            if isinstance(out, dict):
                images = out.get("images")
                if isinstance(images, list):
                    for img in images:
                        if isinstance(img, dict) and img.get("url"):
                            refs.append(img["url"])
                elif isinstance(out.get("url"), str):
                    refs.append(out["url"])
        return refs

    @staticmethod
    def _collect_video_refs(upstream: list[WorkflowNode]) -> list[str]:
        refs: list[str] = []
        for u in upstream:
            if u.kind != "video" or not u.output_json:
                continue
            out = u.output_json
            if isinstance(out, dict):
                videos = out.get("videos")
                if isinstance(videos, list):
                    for v in videos:
                        if isinstance(v, dict) and v.get("url"):
                            refs.append(v["url"])
        return refs

    # ── kind handlers ─────────────────────────────────────────────────

    async def _run_text(
        self,
        prompt: str,
        image_refs: list[str],
        provider: str,
        model_name: str,
        node: WorkflowNode,
    ) -> dict[str, Any]:
        cfg = node.config_json or {}
        system_prompt = cfg.get("system_prompt") or None
        temperature = float(cfg.get("temperature") or 0.7)
        max_tokens = int(cfg.get("max_tokens") or 4096)

        if image_refs:
            # Vision path. Resolve image refs to URLs the VL model can pull.
            urls = [await self._to_public_url(ref) for ref in image_refs]
            try:
                vision = service_container.get_vision_model(provider, model_name)
            except ValueError:
                vision = service_container.get_vision_model()
            text = await vision.generate_text(
                prompt=prompt,
                image_urls=urls,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        else:
            text_model = service_container.get_text_model(provider, model_name)
            text = await text_model.generate_text(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        return {"text": text}

    async def _run_image(
        self,
        prompt: str,
        provider: str,
        model_name: str,
        node: WorkflowNode,
    ) -> dict[str, Any]:
        cfg = node.config_json or {}
        width = int(cfg.get("width") or 1024)
        height = int(cfg.get("height") or 1024)
        n = int(cfg.get("num_images") or 1)
        seed = cfg.get("seed")
        seed = int(seed) if seed is not None else None
        negative = cfg.get("negative_prompt") or None

        image_model = service_container.get_image_model(provider, model_name)
        results = await image_model.generate_image(
            prompt=prompt,
            negative_prompt=negative,
            width=width,
            height=height,
            num_images=n,
            seed=seed,
        )
        if not results:
            raise NodeExecutionError("Image generation returned no results")

        stored: list[dict[str, Any]] = []
        for idx, r in enumerate(results):
            object_key = await self._download_to_storage(
                r.url,
                f"projects/{node.project_id}/nodes/{node.id}/image_{idx}.png",
                "image/png",
            )
            stored.append(
                {"url": object_key, "width": r.width, "height": r.height, "seed": r.seed}
            )
            await self._record_media(node, object_key, r.width, r.height, "image")

        return {"images": stored}

    async def _run_video(
        self,
        prompt: str,
        first_frame: str | None,
        provider: str,
        model_name: str,
        node: WorkflowNode,
    ) -> dict[str, Any]:
        cfg = node.config_json or {}
        width = int(cfg.get("width") or 1080)
        height = int(cfg.get("height") or 1920)
        duration_sec = float(cfg.get("duration_sec") or 5.0)

        image_url: str | None = None
        if first_frame:
            image_url = await self._to_public_url(first_frame)

        video_model = service_container.get_video_model(provider, model_name)
        result = await video_model.generate_video(
            prompt=prompt,
            image_url=image_url,
            duration_sec=duration_sec,
            width=width,
            height=height,
        )

        # Mirror the asset into MinIO so we don't depend on DashScope's
        # short-lived signed URLs for downstream nodes.
        object_key = await self._download_to_storage(
            result.url,
            f"projects/{node.project_id}/nodes/{node.id}/video.mp4",
            "video/mp4",
        )
        await self._record_media(node, object_key, result.width, result.height, "video")

        return {
            "videos": [
                {
                    "url": object_key,
                    "width": result.width,
                    "height": result.height,
                    "duration_sec": result.duration_sec,
                }
            ],
            "task_id": result.task_id,
        }

    # ── helpers ───────────────────────────────────────────────────────

    @staticmethod
    async def _to_public_url(ref: str) -> str:
        """Turn an upstream output reference into a URL the AI provider can fetch.

        References can already be HTTP URLs (passed through) or MinIO
        object keys (signed first).
        """
        if not ref:
            return ref
        if ref.startswith(("http://", "https://", "data:")):
            return ref
        return await storage_service.get_presigned_url(ref)

    @staticmethod
    async def _download_to_storage(src_url: str, key: str, content_type: str) -> str:
        """Pull a remote URL into MinIO and return the object key.

        If `src_url` already looks like our own object key (no scheme), keep it.
        """
        if not src_url.startswith(("http://", "https://")):
            return src_url
        import httpx

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.get(src_url)
            resp.raise_for_status()
            data = resp.content
            mime = resp.headers.get("Content-Type", content_type).split(";")[0]
        await storage_service.upload_bytes(key, data, mime)
        return key

    @staticmethod
    async def _record_media(
        node: WorkflowNode, object_key: str, width: int, height: int, kind: str
    ) -> None:
        async with async_session_factory() as db:
            db.add(
                MediaFile(
                    project_id=node.project_id,
                    node_id=node.id,
                    file_type=kind,
                    file_name=object_key.rsplit("/", 1)[-1],
                    file_url=object_key,
                    mime_type=("image/png" if kind == "image" else "video/mp4"),
                    metadata_json={"width": width, "height": height},
                )
            )
            await db.commit()

    @staticmethod
    async def _any_running(
        db: AsyncSession, project_id: int, current_id: int
    ) -> bool:
        result = await db.execute(
            select(WorkflowNode.id).where(
                WorkflowNode.project_id == project_id,
                WorkflowNode.status == "running",
                WorkflowNode.id != current_id,
            )
        )
        return result.first() is not None

    async def _broadcast(self, node: WorkflowNode) -> None:
        try:
            await websocket_manager.broadcast(
                node.project_id,
                {
                    "type": "node_status",
                    "data": {
                        "node_id": node.id,
                        "kind": node.kind,
                        "status": node.status,
                        "output_json": node.output_json,
                        "error_message": node.error_message,
                    },
                },
            )
        except Exception:
            pass
