"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CustomNode } from "./custom-node";
import { useWorkflowStore } from "@/lib/store/workflow-store";

const nodeTypes = { custom: CustomNode };

const PIPELINE_STEPS = [
  { type: "product_input", label: "商品输入", icon: "Upload" },
  { type: "product_understanding", label: "商品理解", icon: "Scan" },
  { type: "selling_point", label: "卖点生成", icon: "Sparkles" },
  { type: "script", label: "脚本生成", icon: "FileText" },
  { type: "storyboard", label: "分镜生成", icon: "Layout" },
  { type: "prompt", label: "提示词生成", icon: "Wand" },
  { type: "keyframe", label: "关键帧生成", icon: "Image" },
  { type: "video_generation", label: "视频生成", icon: "Video" },
  { type: "subtitle", label: "字幕生成", icon: "Type" },
  { type: "voiceover", label: "配音生成", icon: "Mic" },
  { type: "video_composition", label: "视频合成", icon: "Clapperboard" },
];

export function WorkflowCanvas() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectNode = useWorkflowStore((s) => s.selectNode);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(Number(node.id));
    },
    [selectNode]
  );

  const { rfNodes, rfEdges } = useMemo(() => {
    const existing = new Map(nodes.map((n) => [n.node_type, n]));
    const rfNodes: Node[] = [];
    const rfEdges: Edge[] = [];

    PIPELINE_STEPS.forEach((step, i) => {
      const dbNode = existing.get(step.type);
      const status = dbNode?.status || "pending";
      let outputSummary: string | undefined;

      if (dbNode?.output_json) {
        const out = dbNode.output_json as Record<string, unknown>;
        if (typeof out.title === "string") outputSummary = out.title;
        else if (typeof out.video_title === "string") outputSummary = out.video_title;
        else if (out.scenes && Array.isArray(out.scenes)) outputSummary = `${out.scenes.length} 个分镜`;
        else if (out.images && Array.isArray(out.images)) outputSummary = `${out.images.length} 张关键帧`;
        else if (out.videos && Array.isArray(out.videos)) outputSummary = `${out.videos.length} 段视频`;
        else if (typeof out.final_video_url === "string") outputSummary = "成片就绪";
      }

      rfNodes.push({
        id: String(dbNode?.id || `placeholder-${i}`),
        type: "custom",
        position: { x: 250, y: i * 180 },
        selected: dbNode?.id === selectedNodeId,
        data: {
          label: step.label,
          index: i,
          icon: step.icon,
          status,
          outputSummary,
        },
      });

      if (i > 0) {
        rfEdges.push({
          id: `e-${i}`,
          source: rfNodes[i - 1].id,
          target: rfNodes[i].id,
          animated: status === "running",
        });
      }
    });

    return { rfNodes, rfEdges };
  }, [nodes, selectedNodeId]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="oklch(1 0 0 / 0.10)"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
