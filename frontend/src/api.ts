async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  return body as T;
}

const authHeader = (key: string) => ({ Authorization: `Bearer ${key}` });

export const adminApi = {
  listManagers: (key: string) => request<{ managers: import("./types").Manager[] }>("/api/admin/managers", { headers: authHeader(key) }),
  createManager: (key: string, name: string) =>
    request<{ manager: import("./types").Manager; access_key: string }>("/api/admin/managers", {
      method: "POST",
      headers: authHeader(key),
      body: JSON.stringify({ name }),
    }),
  revokeManager: (key: string, id: string) =>
    request<{ ok: true }>(`/api/admin/managers/${id}/revoke`, { method: "PATCH", headers: authHeader(key) }),
  rotateManagerKey: (key: string, id: string) =>
    request<{ access_key: string }>(`/api/admin/managers/${id}/rotate`, { method: "POST", headers: authHeader(key) }),
  listBoards: (key: string) => request<{ boards: import("./types").BoardSummary[] }>("/api/admin/boards", { headers: authHeader(key) }),
  createBoard: (key: string, team_name: string, manager_ids: string[]) =>
    request<{ board: import("./types").BoardSummary }>("/api/admin/boards", {
      method: "POST",
      headers: authHeader(key),
      body: JSON.stringify({ team_name, manager_ids }),
    }),
  patchBoard: (key: string, id: string, patch: { team_name?: string; is_public?: boolean; manager_ids?: string[] }) =>
    request<{ board: import("./types").BoardSummary }>(`/api/admin/boards/${id}`, {
      method: "PATCH",
      headers: authHeader(key),
      body: JSON.stringify(patch),
    }),
  deleteBoard: (key: string, id: string) =>
    request<{ ok: true }>(`/api/admin/boards/${id}`, { method: "DELETE", headers: authHeader(key) }),
  stats: (key: string) => request<import("./types").Stats>("/api/admin/stats", { headers: authHeader(key) }),
};

export const managerApi = {
  listBoards: (key: string) => request<{ boards: import("./types").BoardSummary[] }>("/api/manager/boards", { headers: authHeader(key) }),
  getBoard: (key: string, boardId: string) =>
    request<{ board: import("./types").Board }>(`/api/manager/boards/${boardId}`, { headers: authHeader(key) }),
  createBucket: (key: string, boardId: string, name: string) =>
    request<{ bucket: import("./types").Bucket }>(`/api/manager/boards/${boardId}/buckets`, {
      method: "POST",
      headers: authHeader(key),
      body: JSON.stringify({ name }),
    }),
  patchBucket: (key: string, boardId: string, id: string, patch: { name?: string; position?: number }) =>
    request(`/api/manager/boards/${boardId}/buckets/${id}`, {
      method: "PATCH",
      headers: authHeader(key),
      body: JSON.stringify(patch),
    }),
  deleteBucket: (key: string, boardId: string, id: string) =>
    request<{ ok: true }>(`/api/manager/boards/${boardId}/buckets/${id}`, { method: "DELETE", headers: authHeader(key) }),
  reorderBuckets: (key: string, boardId: string, ids: string[]) =>
    request<{ ok: true }>(`/api/manager/boards/${boardId}/buckets/order`, {
      method: "PATCH",
      headers: authHeader(key),
      body: JSON.stringify({ ids }),
    }),
  reorderTasks: (key: string, boardId: string, bucketId: string, ids: string[]) =>
    request<{ ok: true }>(`/api/manager/boards/${boardId}/tasks/order`, {
      method: "PATCH",
      headers: authHeader(key),
      body: JSON.stringify({ bucket_id: bucketId, ids }),
    }),
  createTask: (key: string, boardId: string, input: Record<string, unknown>) =>
    request<{ task: import("./types").Task }>(`/api/manager/boards/${boardId}/tasks`, {
      method: "POST",
      headers: authHeader(key),
      body: JSON.stringify(input),
    }),
  patchTask: (key: string, boardId: string, id: string, patch: Record<string, unknown>) =>
    request<{ task: import("./types").Task }>(`/api/manager/boards/${boardId}/tasks/${id}`, {
      method: "PATCH",
      headers: authHeader(key),
      body: JSON.stringify(patch),
    }),
  deleteTask: (key: string, boardId: string, id: string) =>
    request<{ ok: true }>(`/api/manager/boards/${boardId}/tasks/${id}`, { method: "DELETE", headers: authHeader(key) }),
  archiveTask: (key: string, boardId: string, id: string) =>
    request<{ task: import("./types").Task }>(`/api/manager/boards/${boardId}/tasks/${id}/archive`, {
      method: "POST",
      headers: authHeader(key),
    }),
  unarchiveTask: (key: string, boardId: string, id: string) =>
    request<{ task: import("./types").Task }>(`/api/manager/boards/${boardId}/tasks/${id}/unarchive`, {
      method: "POST",
      headers: authHeader(key),
    }),
  patchSettings: (key: string, boardId: string, patch: { allowed_emails?: string[]; assignees?: string[] }) =>
    request(`/api/manager/boards/${boardId}`, { method: "PATCH", headers: authHeader(key), body: JSON.stringify(patch) }),
  listTickets: (key: string, boardId: string, params: { status?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ tickets: import("./types").Ticket[]; total: number; page: number; limit: number }>(
      `/api/manager/boards/${boardId}/tickets${suffix}`,
      { headers: authHeader(key) }
    );
  },
  resolveTicket: (key: string, boardId: string, id: string, action: "accept" | "reject") =>
    request(`/api/manager/boards/${boardId}/tickets/${id}/${action}`, { method: "POST", headers: authHeader(key) }),
};

export const publicApi = {
  getBoard: (slug: string) => request<{ board: import("./types").Board }>(`/api/public/boards/${slug}`),
  getTicketInfo: (slug: string) => request<{ team_name: string; modules: string[] }>(`/api/public/tickets/${slug}`),
  createTicket: (slug: string, input: Record<string, unknown>) =>
    request<{ ticket: import("./types").Ticket }>(`/api/public/tickets/${slug}`, { method: "POST", body: JSON.stringify(input) }),
};
