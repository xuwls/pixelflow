from dataclasses import dataclass, field


@dataclass
class PipelineNode:
    node_type: str
    label: str
    icon: str
    default_config: dict = field(default_factory=dict)


PIPELINE: list[PipelineNode] = [
    PipelineNode(
        node_type="product_input",
        label="Product Input",
        icon="Upload",
    ),
    PipelineNode(
        node_type="product_understanding",
        label="Product Understanding",
        icon="Scan",
        default_config={"model": {"provider": "qwen", "model_name": "qwen-max"}},
    ),
    PipelineNode(
        node_type="selling_point",
        label="Selling Point",
        icon="Sparkles",
        default_config={"model": {"provider": "qwen", "model_name": "qwen-max"}},
    ),
    PipelineNode(
        node_type="script",
        label="Script",
        icon="FileText",
        default_config={"model": {"provider": "qwen", "model_name": "qwen-max"}},
    ),
    PipelineNode(
        node_type="storyboard",
        label="Storyboard",
        icon="Layout",
        default_config={"model": {"provider": "qwen", "model_name": "qwen-max"}},
    ),
    PipelineNode(
        node_type="prompt",
        label="Prompt Generation",
        icon="Wand",
        default_config={"model": {"provider": "qwen", "model_name": "qwen-max"}},
    ),
    PipelineNode(
        node_type="keyframe",
        label="Keyframe Generation",
        icon="Image",
        default_config={
            "model": {"provider": "tongyi_wanxiang", "model_name": "wanx-v1"},
            "width": 720,
            "height": 1280,
        },
    ),
    PipelineNode(
        node_type="video_generation",
        label="Video Generation",
        icon="Video",
        default_config={
            "model": {"provider": "ali_video", "model_name": "wan2.7-t2v"},
            "width": 1080,
            "height": 1920,
        },
    ),
    PipelineNode(
        node_type="subtitle",
        label="Subtitle",
        icon="Type",
    ),
    PipelineNode(
        node_type="voiceover",
        label="Voiceover",
        icon="Mic",
    ),
    PipelineNode(
        node_type="video_composition",
        label="Video Composition",
        icon="Clapperboard",
        default_config={
            "aspect_ratio": "9:16",
            "resolution": "1080x1920",
            "fps": 30,
        },
    ),
]
