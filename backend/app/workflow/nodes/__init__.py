from app.workflow.nodes.base import BaseNodeHandler
from app.workflow.nodes.product_input import ProductInputHandler
from app.workflow.nodes.product_understanding import ProductUnderstandingHandler
from app.workflow.nodes.selling_point import SellingPointHandler
from app.workflow.nodes.script import ScriptHandler
from app.workflow.nodes.storyboard import StoryboardHandler
from app.workflow.nodes.prompt import PromptHandler
from app.workflow.nodes.keyframe import KeyframeHandler
from app.workflow.nodes.video_generation import VideoGenerationHandler
from app.workflow.nodes.subtitle import SubtitleHandler
from app.workflow.nodes.voiceover import VoiceoverHandler
from app.workflow.nodes.video_composition import VideoCompositionHandler
from app.workflow.registry import registry

handlers = [
    ProductInputHandler(),
    ProductUnderstandingHandler(),
    SellingPointHandler(),
    ScriptHandler(),
    StoryboardHandler(),
    PromptHandler(),
    KeyframeHandler(),
    VideoGenerationHandler(),
    SubtitleHandler(),
    VoiceoverHandler(),
    VideoCompositionHandler(),
]

for h in handlers:
    registry.register(h)
