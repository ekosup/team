export type Bucket = {
  id: string;
  board_id: string;
  name: string;
  position: number;
};

export type Task = {
  id: string;
  board_id: string;
  bucket_id: string;
  title: string;
  description: string | null;
  module: string | null;
  target: string | null;
  assignee: string | null;
  priority: Priority;
  blocked_reason: string | null;
  timeline_start: string | null;
  timeline_end: string | null;
  position: number;
  archived_at: string | null;
  updated_at: string;
};

export type Priority = "low" | "normal" | "high";

export type ProjectStatus = "development" | "staging" | "production" | "maintenance" | "retired";

export const PROJECT_STATUS_VALUES: ProjectStatus[] = [
  "development",
  "staging",
  "production",
  "maintenance",
  "retired",
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
  maintenance: "Maintenance",
  retired: "Retired",
};

export type BoardModule = { name: string; description: string };

export type Manager = {
  id: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
};

export type Board = {
  id: string;
  team_name: string;
  public_slug: string;
  is_public: number;
  /** exact emails or "*@domain" */
  allowed_emails: string[];
  /** PIC names offered in the task dropdown */
  assignees: string[];
  /** curated modules for the App > Module project view */
  modules: BoardModule[];
  status: ProjectStatus;
  /** public endpoint only: allow-list is hidden, this says whether /t/:slug is open */
  tickets_enabled?: boolean;
  buckets: Bucket[];
  tasks: Task[];
  managers: Manager[];
};

export type Ticket = {
  id: string;
  board_id: string;
  email: string;
  title: string;
  description: string | null;
  module: string | null;
  priority: Priority;
  status: "open" | "accepted" | "rejected";
  task_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type BoardSummary = {
  id: string;
  team_name: string;
  public_slug: string;
  is_public: number;
  status: ProjectStatus;
  created_at: string;
  managers: Manager[];
};

export type Doc = {
  id: string;
  board_id: string;
  title: string;
  /** Tiptap JSON doc, serialized; null on list rows when is_secret (fetch by id to reveal) */
  content: string | null;
  is_secret: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Stats = {
  board_count: number;
  active_manager_count: number;
  tasks_by_bucket: { board_name: string; bucket_name: string; count: number }[];
  tasks_by_module: { board_name: string; module: string; count: number }[];
};
