import { useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { Board, Bucket, Task } from "../types";
import { ArchivedTaskRow, AssigneeSelect, ModuleSelect, TaskCard } from "./TaskCard";
import { needsAttention, taskFlags } from "../lib/task";

export type KanbanBoardProps = {
  board: Board;
  readOnly: boolean;
  onCreateBucket?: (name: string) => void;
  onRenameBucket?: (bucket: Bucket, name: string) => void;
  onMoveBucket?: (bucket: Bucket, direction: -1 | 1) => void;
  onDeleteBucket?: (bucket: Bucket) => void;
  onCreateTask?: (bucketId: string, input: Partial<Task>) => void;
  onUpdateTask?: (task: Task, patch: Partial<Task>) => void;
  onArchiveTask?: (task: Task) => void;
  onUnarchiveTask?: (task: Task) => void;
  /** permanent delete — only ever offered for an already-archived task */
  onDeleteTask?: (task: Task) => void;
  /** Moves the listed tasks into bucketId, in this order. */
  onReorderTasks?: (bucketId: string, ids: string[]) => void;
};

function useUniqueValues(tasks: Task[], field: "module" | "target" | "assignee") {
  return useMemo(
    () => [...new Set(tasks.map((t) => t[field]).filter((v): v is string => !!v))].sort(),
    [tasks, field]
  );
}

type DropTarget = { bucketId: string; index: number };

export function KanbanBoard({
  board,
  readOnly,
  onCreateBucket,
  onRenameBucket,
  onMoveBucket,
  onDeleteBucket,
  onCreateTask,
  onUpdateTask,
  onArchiveTask,
  onUnarchiveTask,
  onDeleteTask,
  onReorderTasks,
}: KanbanBoardProps) {
  const [moduleFilter, setModuleFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  // collapsed columns are a view preference only — not persisted, resets on reload
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = (bucketId: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(bucketId) ? next.delete(bucketId) : next.add(bucketId);
      return next;
    });

  // archived tasks sit outside the active workflow: excluded from filters, counts, and drag/drop
  const activeTasks = useMemo(() => board.tasks.filter((t) => !t.archived_at), [board.tasks]);

  const modules = useUniqueValues(activeTasks, "module");
  const targets = useUniqueValues(activeTasks, "target");
  const assignees = useUniqueValues(activeTasks, "assignee");

  const buckets = useMemo(() => [...board.buckets].sort((a, b) => a.position - b.position), [board.buckets]);
  // ponytail: rightmost column counts as "done" so its tasks never show as overdue; add an explicit flag if teams disagree
  const doneBucketId = buckets.at(-1)?.id;

  const flagsById = useMemo(
    () => new Map(activeTasks.map((t) => [t.id, taskFlags(t, t.bucket_id === doneBucketId)])),
    [activeTasks, doneBucketId]
  );
  const lateCount = activeTasks.filter((t) => flagsById.get(t.id)!.overdueDays > 0).length;
  const blockedCount = activeTasks.filter((t) => flagsById.get(t.id)!.blocked).length;

  const filtering = !!(moduleFilter || targetFilter || assigneeFilter || attentionOnly);
  const filteredTasks = activeTasks.filter(
    (t) =>
      (!moduleFilter || t.module === moduleFilter) &&
      (!targetFilter || t.target === targetFilter) &&
      (!assigneeFilter || t.assignee === assigneeFilter) &&
      (!attentionOnly || needsAttention(flagsById.get(t.id)!))
  );

  const resetFilters = () => {
    setModuleFilter("");
    setTargetFilter("");
    setAssigneeFilter("");
    setAttentionOnly(false);
  };

  // --- drag & drop (native, manager only) ---
  const canDrag = !readOnly && !!onReorderTasks && !filtering;

  const handleDragOver = (bucketId: string) => (e: DragEvent<HTMLElement>) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const cards = [...e.currentTarget.querySelectorAll<HTMLElement>(".task")].filter(
      (el) => el.dataset.taskId !== dragId
    );
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    if (drop?.bucketId !== bucketId || drop.index !== index) setDrop({ bucketId, index });
  };

  const handleDrop = (bucketId: string) => (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!dragId || !drop || drop.bucketId !== bucketId) return;
    const ids = activeTasks
      .filter((t) => t.bucket_id === bucketId && t.id !== dragId)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id);
    ids.splice(drop.index, 0, dragId);
    onReorderTasks?.(bucketId, ids);
    setDragId(null);
    setDrop(null);
  };

  const attentionLabel = [lateCount && `${lateCount} terlambat`, blockedCount && `${blockedCount} terhambat`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="kanban">
      {activeTasks.length > 0 && (
        <div className="kanban-toolbar">
          {modules.length > 0 && (
            <select aria-label="Filter module" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">Semua module</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {targets.length > 0 && (
            <select aria-label="Filter target" value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)}>
              <option value="">Semua target</option>
              {targets.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {assignees.length > 0 && (
            <select aria-label="Filter PIC" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">Semua PIC</option>
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          <button
            className={`ghost toggle${attentionOnly ? " on" : ""}`}
            aria-pressed={attentionOnly}
            onClick={() => setAttentionOnly((v) => !v)}
          >
            Perlu perhatian
          </button>
          {filtering && (
            <button className="text" onClick={resetFilters}>
              Reset
            </button>
          )}
          <span className="count">
            {filtering ? `${filteredTasks.length} dari ${activeTasks.length}` : activeTasks.length} task
            {attentionLabel && <span className="attention"> · {attentionLabel}</span>}
          </span>
        </div>
      )}

      {buckets.length === 0 && (
        <p className="column-empty">
          {readOnly
            ? "Board ini belum punya kolom."
            : "Belum ada kolom. Buat yang pertama, misalnya Backlog, Dikerjakan, Selesai."}
        </p>
      )}

      <div className="kanban-columns">
        {buckets.map((bucket, i) => {
          const tasks = filteredTasks
            .filter((t) => t.bucket_id === bucket.id)
            .sort((a, b) => a.position - b.position);
          const archivedTasks = board.tasks
            .filter((t) => t.archived_at && t.bucket_id === bucket.id)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
          const total = board.tasks.filter((t) => t.bucket_id === bucket.id).length;
          const dropHere = drop?.bucketId === bucket.id ? drop.index : -1;
          const isCollapsed = collapsedIds.has(bucket.id);
          return (
            <section
              className={`column${dragId ? " dragging" : ""}${isCollapsed ? " collapsed" : ""}`}
              key={bucket.id}
              style={{ "--i": i } as CSSProperties}
              onDragOver={canDrag && !isCollapsed ? handleDragOver(bucket.id) : undefined}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
              }}
              onDrop={canDrag && !isCollapsed ? handleDrop(bucket.id) : undefined}
            >
              <header className="column-header">
                <button
                  className="text icon column-toggle"
                  onClick={() => toggleCollapse(bucket.id)}
                  aria-label={isCollapsed ? `Buka kolom ${bucket.name}` : `Tutup kolom ${bucket.name}, fokus ke kolom lain`}
                  title={isCollapsed ? "Buka kolom" : "Tutup kolom"}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
                <ColumnTitle
                  bucket={bucket}
                  readOnly={readOnly || !onRenameBucket}
                  onRename={(name) => onRenameBucket?.(bucket, name)}
                />
                <span className="count">{tasks.length}</span>
                {!readOnly && (
                  <span className="column-actions">
                    <button
                      className="text icon"
                      disabled={i === 0}
                      onClick={() => onMoveBucket?.(bucket, -1)}
                      aria-label="Geser kolom ke kiri"
                      title="Geser ke kiri"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      className="text icon"
                      disabled={i === buckets.length - 1}
                      onClick={() => onMoveBucket?.(bucket, 1)}
                      aria-label="Geser kolom ke kanan"
                      title="Geser ke kanan"
                    >
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="text icon danger"
                      disabled={total > 0}
                      onClick={() => onDeleteBucket?.(bucket)}
                      aria-label={`Hapus kolom ${bucket.name}`}
                      title={total > 0 ? "Pindahkan atau hapus task dulu" : "Hapus kolom"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                )}
              </header>

              {tasks.length === 0 && dropHere < 0 && (
                <p className="column-empty">{filtering ? "Tidak ada yang cocok." : "Kosong."}</p>
              )}

              {tasks.map((task, idx) => (
                <div key={task.id} className="task-slot">
                  {dropHere === idx && <div className="drop-line" />}
                  <TaskCard
                    task={task}
                    flags={flagsById.get(task.id)!}
                    readOnly={readOnly}
                    buckets={buckets}
                    assignees={board.assignees}
                    modules={board.modules}
                    onUpdate={(patch) => onUpdateTask?.(task, patch)}
                    onArchive={() => onArchiveTask?.(task)}
                    onDragStart={
                      canDrag
                        ? (e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", task.id);
                            setDragId(task.id);
                          }
                        : undefined
                    }
                    onDragEnd={() => {
                      setDragId(null);
                      setDrop(null);
                    }}
                  />
                </div>
              ))}
              {dropHere === tasks.length && <div className="drop-line" />}

              {!readOnly && (
                <NewTaskForm
                  assignees={board.assignees}
                  modules={board.modules}
                  onCreate={(input) => onCreateTask?.(bucket.id, input)}
                />
              )}

              {archivedTasks.length > 0 && (
                <details className="archive-details">
                  <summary>Diarsipkan ({archivedTasks.length})</summary>
                  {archivedTasks.map((task) => (
                    <ArchivedTaskRow
                      key={task.id}
                      task={task}
                      readOnly={readOnly}
                      onUnarchive={() => onUnarchiveTask?.(task)}
                      onDelete={() => onDeleteTask?.(task)}
                    />
                  ))}
                </details>
              )}
            </section>
          );
        })}

        {!readOnly && (
          <form
            className="column new-bucket"
            style={{ "--i": buckets.length } as CSSProperties}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newBucketName.trim()) return;
              onCreateBucket?.(newBucketName.trim());
              setNewBucketName("");
            }}
          >
            <input
              aria-label="Nama kolom baru"
              placeholder="Kolom baru"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
            />
            {newBucketName.trim() && (
              <div className="row">
                <button type="submit">Tambah kolom</button>
                <button type="button" className="text" onClick={() => setNewBucketName("")}>
                  Batal
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function ColumnTitle({
  bucket,
  readOnly,
  onRename,
}: {
  bucket: Bucket;
  readOnly: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bucket.name);

  if (!editing) {
    return (
      <h3
        title={readOnly ? bucket.name : "Klik dua kali untuk ganti nama"}
        onDoubleClick={() => {
          if (readOnly) return;
          setName(bucket.name);
          setEditing(true);
        }}
      >
        {bucket.name}
      </h3>
    );
  }

  const commit = () => {
    const next = name.trim();
    if (next && next !== bucket.name) onRename(next);
    setEditing(false);
  };

  return (
    <input
      className="column-rename"
      autoFocus
      value={name}
      aria-label="Nama kolom"
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function NewTaskForm({
  assignees,
  modules,
  onCreate,
}: {
  assignees: string[];
  modules: string[];
  onCreate: (input: Partial<Task>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [module, setModule] = useState("");
  const [target, setTarget] = useState("");
  const [assignee, setAssignee] = useState("");

  if (!open) {
    return (
      <button className="text add-task" onClick={() => setOpen(true)}>
        + Tambah task
      </button>
    );
  }

  const close = () => {
    setTitle("");
    setModule("");
    setTarget("");
    setAssignee("");
    setOpen(false);
  };

  return (
    <form
      className="task-form"
      onKeyDown={(e) => e.key === "Escape" && close()}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onCreate({
          title: title.trim(),
          module: module || undefined,
          target: target || undefined,
          assignee: assignee || undefined,
        } as Partial<Task>);
        close();
      }}
    >
      <input autoFocus placeholder="Judul task" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="row">
        <ModuleSelect modules={modules} value={module} onChange={setModule} />
        <input placeholder="Target" value={target} onChange={(e) => setTarget(e.target.value)} />
      </div>
      <AssigneeSelect assignees={assignees} value={assignee} onChange={setAssignee} />
      <div className="row">
        <button type="submit">Tambah</button>
        <button type="button" className="text" onClick={close}>
          Batal
        </button>
      </div>
    </form>
  );
}
