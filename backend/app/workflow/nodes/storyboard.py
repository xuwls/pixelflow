import json
import logging

from app.services.ai.model_registry import get_default_model
from app.workflow.context import WorkflowContext
from app.workflow.nodes.base import BaseNodeHandler
from app.workflow.prompts import resolve_user_prompt

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a professional video director and cinematographer. "
    "Always respond with valid JSON only."
)


class StoryboardHandler(BaseNodeHandler):
    node_type = "storyboard"
    node_label = "Storyboard"

    async def execute(self, context: WorkflowContext) -> dict:
        script = context.get_output("script") or {}
        understanding = context.get_output("product_understanding") or {}
        config = (context.current_node.config_json or {}) if context.current_node else {}
        model_config = config.get("model", {})

        default = get_default_model("文字编辑/生成")
        provider = model_config.get("provider") or (default.provider if default else "qwen")
        model_name = model_config.get("model_name") or (default.model_name if default else "qwen-max")
        temperature = model_config.get("temperature", 0.7)
        max_tokens = model_config.get("max_tokens", 3072)

        text_model = context.services.get_text_model(provider, model_name)

        variables = {
            "script_json": json.dumps(script, ensure_ascii=False, indent=2),
            "style": understanding.get("style", ""),
        }
        user_prompt = resolve_user_prompt(
            self.node_type, config.get("user_prompt"), variables
        )

        import time as _time
        _t0 = _time.monotonic()
        raw = await text_model.generate_text(
            prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        _duration_ms = int((_time.monotonic() - _t0) * 1000)

        try:
            parsed = json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())
        except json.JSONDecodeError:
            logger.warning("Failed to parse Qwen output as JSON")
            parsed = {"scenes": []}

        if context.current_node:
            context.current_node.debug_log = {
                "input": {
                    "provider": provider,
                    "model_name": model_name,
                    "prompt": user_prompt,
                    "system_prompt": SYSTEM_PROMPT,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "is_default_template": not config.get("user_prompt"),
                },
                "output": {"raw": raw, "parsed": parsed},
                "duration_ms": _duration_ms,
            }

        return parsed
