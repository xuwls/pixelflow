"""
Default user-prompt templates for each LLM/VL node, plus a tiny render
helper that lets a user-supplied template override the default while
still getting upstream-data variables filled in.

Templates use Python str.format() with named placeholders. Variables
that aren't provided at render time degrade to an empty string instead
of raising — so a user editing the template can safely remove a
placeholder they don't care about.
"""

from __future__ import annotations

from string import Formatter
from typing import Any


class _SafeFormatter(Formatter):
    """str.format that returns '' for missing keys and leaves text-only segments alone."""

    def get_value(self, key, args, kwargs):
        if isinstance(key, str):
            return kwargs.get(key, "")
        return super().get_value(key, args, kwargs)


_FORMATTER = _SafeFormatter()


def render_prompt(template: str, variables: dict[str, Any]) -> str:
    try:
        return _FORMATTER.format(template, **variables)
    except (IndexError, KeyError, ValueError):
        # If the template has truly malformed syntax, fall back to literal
        # so a typo by the user doesn't blow up the whole workflow run.
        return template


# ── Default user_prompt templates per node ───────────────────────────────
# Variables available to each template are documented inline. Handlers
# will resolve `config.user_prompt` first, then fall back here.

DEFAULT_PROMPTS: dict[str, str] = {
    # 02 商品理解 (VL)
    # Vars: product_name, description
    "product_understanding": """Analyze this product image alongside the textual context below.

## Textual context
Product Name: {product_name}
Product Description: {description}

Identify what the product actually is from the image, then combine the
visual evidence with the text to produce the following information as
valid JSON:
- category: The product category (e.g., "Consumer Electronics", "Fashion", "Food", "Skincare")
- style: The visual style (e.g., "Modern Minimalist", "Luxury", "Casual", "Warm & Cozy")
- target_user: Target audience description (age, interests, lifestyle)
- scenes: List of 3-5 usage scenes (e.g., ["Office desk", "Coffee shop", "Morning kitchen counter"])
- selling_points: List of 3-5 concrete selling points the image and description support

Return ONLY valid JSON, no other text.""",

    # 03 卖点生成 (LLM)
    # Vars: product_name, description, category, style, target_user,
    #       scenes_json, selling_points_json
    "selling_point": """Generate marketing copy for this product:

## PRODUCT INFO
Name: {product_name}
Description: {description}

## PRODUCT ANALYSIS
Category: {category}
Style: {style}
Target User: {target_user}
Scenes: {scenes_json}
Selling Points: {selling_points_json}

Generate the following in valid JSON:
- title: A catchy marketing title (10-20 characters, suitable for social media)
- marketing_copy: A persuasive marketing description (50-100 words, focus on benefits)
- emotion_copy: Emotional/social-media 种草 copy (30-60 words, create desire and aspiration)

Return ONLY valid JSON, no other text.""",

    # 04 脚本生成 (LLM)
    # Vars: product_name, category, target_user, title, marketing_copy, emotion_copy
    "script": """Create a short video script for social media marketing:

## PRODUCT
Name: {product_name}
Category: {category}
Target User: {target_user}

## KEY MESSAGES
Title: {title}
Marketing Copy: {marketing_copy}
Emotion Copy: {emotion_copy}

Generate in valid JSON:
- video_title: A compelling short video title
- scenes: An array of 4-6 scenes. Each scene has:
  - index: (1-based)
  - type: "opening" | "feature" | "transition" | "climax" | "cta"
  - description: Visual description (15-30 words)
  - narration: Voiceover text (10-20 words, conversational tone)

Return ONLY valid JSON.""",

    # 05 分镜生成 (LLM)
    # Vars: script_json, style
    "storyboard": """Create a detailed storyboard for a short video ad:

## VIDEO SCRIPT
{script_json}

## PRODUCT STYLE
{style}

For each scene in the script, provide in valid JSON:
- scenes: Array of objects with:
  - scene_index: integer matching script index
  - duration: shot duration in seconds (2-6)
  - camera: camera movement description (e.g. "Close-up slow pan", "Medium dolly in")
  - subtitle: on-screen subtitle text matching the narration
  - sound_effect: brief sound suggestion

The total duration should be 15-30 seconds.

Return ONLY valid JSON.""",

    # 06 提示词生成 (LLM)
    # Vars: style, category, storyboard_json, script_json
    "prompt": """Generate image and video generation prompts for each scene:

## PRODUCT INFO
Style: {style}
Category: {category}

## STORYBOARD
{storyboard_json}

## SCRIPT
{script_json}

For each scene, generate in valid JSON:
- scenes: Array with:
  - scene_index: matching integer
  - image_prompt: Detailed AI image generation prompt in English (include style, lighting, composition, mood, quality keywords like "8K, cinematic, product photography")
  - video_prompt: Detailed AI video generation prompt in English (include camera movement, action description, transitions, lighting changes)

Return ONLY valid JSON.""",
}


def get_default_prompt(node_type: str) -> str:
    return DEFAULT_PROMPTS.get(node_type, "")


def resolve_user_prompt(
    node_type: str, config_user_prompt: str | None, variables: dict[str, Any]
) -> str:
    template = config_user_prompt if (config_user_prompt and config_user_prompt.strip()) \
        else get_default_prompt(node_type)
    return render_prompt(template, variables)
