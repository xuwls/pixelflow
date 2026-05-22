export const NODE_LABELS: Record<string, string> = {
  product_input: "Product Input",
  product_understanding: "Product Understanding",
  selling_point: "Selling Point",
  script: "Script",
  storyboard: "Storyboard",
  prompt: "Prompt Generation",
  keyframe: "Keyframe Generation",
  video_generation: "Video Generation",
  subtitle: "Subtitle",
  voiceover: "Voiceover",
  video_composition: "Video Composition",
};

export const ASPECT_RATIOS = [
  { label: "9:16 (TikTok, Reels)", value: "9:16", width: 1080, height: 1920 },
  { label: "3:4 (Xiaohongshu)", value: "3:4", width: 1080, height: 1440 },
  { label: "16:9 (YouTube)", value: "16:9", width: 1920, height: 1080 },
  { label: "1:1 (Instagram)", value: "1:1", width: 1080, height: 1080 },
];

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  douyin: "Douyin",
  xiaohongshu: "Xiaohongshu",
  wechat: "WeChat Video",
  youtube: "YouTube Shorts",
};
