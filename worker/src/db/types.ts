export type ManagerRow = {
  id: string;
  name: string;
  access_key_hash: string;
  created_at: string;
  revoked_at: string | null;
};

export type PublicManager = Omit<ManagerRow, "access_key_hash">;

export type BoardRow = {
  id: string;
  team_name: string;
  public_slug: string;
  is_public: number;
  /** JSON array: exact emails or "*@domain" patterns */
  allowed_emails: string;
  /** JSON array of PIC names */
  assignees: string;
  created_at: string;
};

export type TicketRow = {
  id: string;
  board_id: string;
  email: string;
  title: string;
  description: string | null;
  module: string | null;
  priority: "low" | "normal" | "high";
  status: "open" | "accepted" | "rejected";
  task_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type BoardWithManagers = BoardRow & { managers: PublicManager[] };

export type BucketRow = {
  id: string;
  board_id: string;
  name: string;
  position: number;
};

export type TaskRow = {
  id: string;
  board_id: string;
  bucket_id: string;
  title: string;
  description: string | null;
  module: string | null;
  target: string | null;
  assignee: string | null;
  priority: "low" | "normal" | "high";
  blocked_reason: string | null;
  timeline_start: string | null;
  timeline_end: string | null;
  position: number;
  /** set = archived (soft-deleted); must be non-null before the task can be hard-deleted */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardWithContent = BoardRow & {
  buckets: BucketRow[];
  tasks: TaskRow[];
};
