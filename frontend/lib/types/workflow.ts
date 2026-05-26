export type NodeKind = "text" | "image" | "video";

export type NodeStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

export interface WorkflowNode {
  id: number;
  project_id: number;
  kind: NodeKind;
  title: string | null;
  position_x: number;
  position_y: number;
  prompt: string | null;
  status: NodeStatus;
  config_json: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  error_message: string | null;
  debug_log: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowEdge {
  id: number;
  project_id: number;
  source_node_id: number;
  target_node_id: number;
}

export interface MediaFile {
  id: number;
  project_id: number;
  node_id: number | null;
  file_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  scene_index: number | null;
  created_at: string;
}

export interface WSMessage {
  type: "node_status" | "workflow_cancelled";
  data: {
    node_id?: number;
    kind?: NodeKind;
    status?: NodeStatus;
    output_json?: Record<string, unknown> | null;
    error_message?: string | null;
    project_id?: number;
    message?: string;
  };
}
