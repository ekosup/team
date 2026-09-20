import { describe, expect, it } from "vitest";
import {
  createTaskSchema,
  patchTaskSchema,
  createBoardSchema,
  reorderBucketsSchema,
  reorderTasksSchema,
  createTicketSchema,
  patchBoardSettingsSchema,
  emailAllowed,
} from "../src/lib/schemas";

describe("tickets", () => {
  it("emailAllowed matches exact emails and *@domain, case-insensitively", () => {
    const patterns = ["ekos@kemenkeu.go.id", "*@djpb.go.id"];
    expect(emailAllowed("ekos@kemenkeu.go.id", patterns)).toBe(true);
    expect(emailAllowed("EKOS@kemenkeu.go.id", patterns)).toBe(true);
    expect(emailAllowed("budi@kemenkeu.go.id", patterns)).toBe(false);
    expect(emailAllowed("anyone@djpb.go.id", patterns)).toBe(true);
    expect(emailAllowed("anyone@sub.djpb.go.id", patterns)).toBe(false);
    expect(emailAllowed("anyone@djpb.go.id", [])).toBe(false);
  });

  it("settings accept emails and *@domain patterns only", () => {
    expect(patchBoardSettingsSchema.safeParse({ allowed_emails: ["a@b.co", "*@b.co"] }).success).toBe(true);
    expect(patchBoardSettingsSchema.safeParse({ allowed_emails: ["*"] }).success).toBe(false);
    expect(patchBoardSettingsSchema.safeParse({ allowed_emails: ["no-at-sign"] }).success).toBe(false);
    expect(patchBoardSettingsSchema.safeParse({ assignees: ["Ekos", " "] }).success).toBe(false);
  });

  it("ticket needs a real email and title", () => {
    expect(createTicketSchema.safeParse({ email: "x@y.id", title: "Bug" }).success).toBe(true);
    expect(createTicketSchema.safeParse({ email: "nope", title: "Bug" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ email: "x@y.id", title: " " }).success).toBe(false);
  });
});

describe("createTaskSchema", () => {
  it("accepts a minimal valid task", () => {
    const result = createTaskSchema.safeParse({ bucket_id: "b1", title: "Do the thing" });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = createTaskSchema.safeParse({ bucket_id: "b1" });
    expect(result.success).toBe(false);
  });

  it("rejects malformed timeline dates", () => {
    const result = createTaskSchema.safeParse({ bucket_id: "b1", title: "x", timeline_start: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

describe("patchTaskSchema", () => {
  it("allows clearing an optional field with null", () => {
    const result = patchTaskSchema.safeParse({ module: null, blocked_reason: null });
    expect(result.success).toBe(true);
  });

  it("only accepts known priorities", () => {
    expect(patchTaskSchema.safeParse({ priority: "high" }).success).toBe(true);
    expect(patchTaskSchema.safeParse({ priority: "urgent" }).success).toBe(false);
  });
});

describe("reorder schemas", () => {
  it("bucket order needs at least one id, task order needs a bucket", () => {
    expect(reorderBucketsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(reorderBucketsSchema.safeParse({ ids: ["a", "b"] }).success).toBe(true);
    expect(reorderTasksSchema.safeParse({ ids: ["t1"] }).success).toBe(false);
    expect(reorderTasksSchema.safeParse({ bucket_id: "b1", ids: [] }).success).toBe(true);
  });
});

describe("createBoardSchema", () => {
  it("requires team_name and at least one manager_id", () => {
    expect(createBoardSchema.safeParse({}).success).toBe(false);
    expect(createBoardSchema.safeParse({ team_name: "A", manager_ids: [] }).success).toBe(false);
    expect(createBoardSchema.safeParse({ team_name: "A", manager_ids: ["m1", "m2"] }).success).toBe(true);
  });
});
