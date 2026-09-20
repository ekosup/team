import { z } from "zod";

export const createManagerSchema = z.object({
  name: z.string().min(1).max(120),
});

export const createBoardSchema = z.object({
  team_name: z.string().min(1).max(120),
  manager_ids: z.array(z.string().min(1)).min(1),
});

export const projectStatusValues = ["development", "staging", "production", "maintenance", "retired"] as const;

export const patchBoardSchema = z.object({
  team_name: z.string().min(1).max(120).optional(),
  is_public: z.boolean().optional(),
  status: z.enum(projectStatusValues).optional(),
  manager_ids: z.array(z.string().min(1)).min(1).optional(),
});

export const createBucketSchema = z.object({
  name: z.string().min(1).max(80),
  position: z.number().int().min(0).optional(),
});

export const patchBucketSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderBucketsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const priorityValues = ["low", "normal", "high"] as const;

export const createTaskSchema = z.object({
  bucket_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  module: z.string().max(80).optional(),
  target: z.string().max(80).optional(),
  assignee: z.string().max(80).optional(),
  priority: z.enum(priorityValues).optional(),
  blocked_reason: z.string().max(300).optional(),
  timeline_start: z.string().date().optional(),
  timeline_end: z.string().date().optional(),
  position: z.number().int().min(0).optional(),
});

export const patchTaskSchema = z.object({
  bucket_id: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  module: z.string().max(80).nullable().optional(),
  target: z.string().max(80).nullable().optional(),
  assignee: z.string().max(80).nullable().optional(),
  priority: z.enum(priorityValues).optional(),
  blocked_reason: z.string().max(300).nullable().optional(),
  timeline_start: z.string().date().nullable().optional(),
  timeline_end: z.string().date().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderTasksSchema = z.object({
  bucket_id: z.string().min(1),
  ids: z.array(z.string().min(1)),
});

const emailPattern = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(\*|[^\s@*]+)@[^\s@*]+\.[^\s@*]+$/, "use an email or *@domain");

export const boardModuleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().default(""),
});

export const patchBoardSettingsSchema = z.object({
  allowed_emails: z.array(emailPattern).max(200).optional(),
  assignees: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  modules: z.array(boardModuleSchema).max(100).optional(),
  status: z.enum(projectStatusValues).optional(),
});

export const ticketListQuerySchema = z.object({
  status: z.enum(["open", "accepted", "rejected", "all"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createTicketSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  module: z.string().max(80).optional(),
  priority: z.enum(priorityValues).optional(),
});

// content is a Tiptap JSON document serialized to a string (semi-structured, editor-agnostic on the wire)
export const createDocSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().max(100000),
  is_secret: z.boolean().optional().default(false),
  position: z.number().int().min(0).optional(),
});

export const patchDocSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().max(100000).optional(),
  is_secret: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderDocsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

/** patterns: exact emails or "*@domain"; all lowercase. Empty list allows nobody. */
export function emailAllowed(email: string, patterns: string[]): boolean {
  const e = email.toLowerCase();
  const domain = e.slice(e.indexOf("@") + 1);
  return patterns.some((p) => (p.startsWith("*@") ? p.slice(2) === domain : p === e));
}
