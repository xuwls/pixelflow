import json
import logging

from app.services.ai.model_registry import get_default_model
from app.workflow.context import WorkflowContext
from app.workflow.nodes.base import BaseNodeHandler
from app.workflow.prompts import get_default_prompt, resolve_user_prompt

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a professional product analyst for e-commerce marketing. "
    "Combine visual cues from the product image with the textual context "
    "to produce structured insight. Always respond with valid JSON only."
)

OUTPUT_SCHEMA = {
    "category": "string - product category",
    "style": "string - visual style",
    "target_user": "string - target audience description",
    "scenes": ["list of usage scene descriptions"],
    "selling_points": ["list of key selling points"],
}


class ProductUnderstandingHandler(BaseNodeHandler):
    node_type = "product_understanding"
    node_label = "Product Understanding"

    async def execute(self, context: WorkflowContext) -> dict:
        product_input = context.get_output("product_input") or {}
        config = (context.current_node.config_json or {}) if context.current_node else {}
        model_config = config.get("model", {})

        default = get_default_model("vl")
        provider = model_config.get("provider") or (default.provider if default else "qwen_vl")
        model_name = model_config.get("model_name") or (default.model_name if default else "qwen-vl-max")
        temperature = model_config.get("temperature", 0.7)
        max_tokens = model_config.get("max_tokens", 2048)

        # User-supplied images take precedence; fall back to the project cover.
        images = product_input.get("images") or []
        if not images and context.project.cover_url:
            images = [context.project.cover_url]

        variables = {
            "product_name": product_input.get("product_name", ""),
            "description": product_input.get("description", ""),
        }
        user_prompt = resolve_user_prompt(
            self.node_type, config.get("user_prompt"), variables
        )

        vision_model = context.services.get_vision_model(provider, model_name)

        import time as _time
        _t0 = _time.monotonic()
        raw = await vision_model.generate_text(
            prompt=user_prompt,
            image_urls=images,
            system_prompt=SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        _duration_ms = int((_time.monotonic() - _t0) * 1000)

        try:
            parsed = json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())
        except json.JSONDecodeError:
            logger.warning("Failed to parse Qwen-VL output as JSON, using raw output")
            parsed = {
                "raw_analysis": raw,
                "category": "",
                "style": "",
                "target_user": "",
                "scenes": [],
                "selling_points": [],
            }

        if context.current_node:
            context.current_node.debug_log = {
                "input": {
                    "provider": provider,
                    "model_name": model_name,
                    "prompt": user_prompt,
                    "system_prompt": SYSTEM_PROMPT,
                    "images": images,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "is_default_template": not config.get("user_prompt"),
                },
                "output": {"raw": raw, "parsed": parsed},
                "duration_ms": _duration_ms,
            }

        return parsed
