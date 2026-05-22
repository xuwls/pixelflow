export interface WorkflowNode {
  id: number;
  project_id: number;
  node_type: string;
  node_index: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
  config_json: Record<string, unknown> | null;
  input_json: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  error_message: string | null;
  debug_log: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
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

export interface WorkflowStatus {
  project_status: string;
  nodes: WorkflowNode[];
}

export interface PipelineStep {
  node_type: string;
  label: string;
  icon: string;
}

export interface WSMessage {
  type: "node_status" | "run_status" | "workflow_cancelled";
  data: {
    node_id?: number;
    node_type?: string;
    node_index?: number;
    status?: string;
    output_json?: Record<string, unknown> | null;
    error_message?: string | null;
    debug_log?: Record<string, unknown> | null;
    run_id?: number;
    current_node_index?: number;
    project_id?: number;
    message?: string;
  };
}
