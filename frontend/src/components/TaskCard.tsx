import { useState, type DragEvent } from "react";
import { Archive } from "lucide-react";
import type { Bucket, Priority, Task } from "../types";
import { formatRange, type TaskFlags } from "../lib/task";

/** PIC dropdown from the board's assignee list. A value not in the list (legacy free text) stays selectable. */
export function AssigneeSelect({
  assignees,
  value,
  onChange,
}: {
  assignees: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options = value && !assignees.includes(value) ? [value, ...assignees] : assignees;
  return (
    <select
      aria-label="PIC"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={assignees.length === 0 ? "Tambah daftar PIC di Pengaturan board" : undefined}
    >
      <option value="">{assignees.length === 0 ? "PIC belum diatur" : "Tanpa PIC"}</option>
      {options.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}

/** Module dropdown from the board's curated module list. A value not in the list (legacy free text) stays selectable. */
export function ModuleSelect({
  modules,
  value,
  onChange,
}: {
  modules: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options = value && !modules.includes(value) ? [value, ...modules] : modules;
  return (
    <select
      aria-label="Module"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={modules.length === 0 ? "Tambah daftar module di tampilan Project" : undefined}
    >
      <option value="">{modules.length === 0 ? "Module belum diatur" : "Tanpa module"}</option>
      {options.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}

export function TaskCard({
  task,
  flags,
  readOnly,
  buckets,
  assignees,
  modules,
  onUpdate,
  onArchive,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  flags: TaskFlags;
  readOnly: boolean;
  buckets: Bucket[];
  assignees: string[];
  modules: string[];
  onUpdate: (patch: Partial<Task>) => void;
  onArchive: () => void;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditTaskForm
        task={task}
        buckets={buckets}
        assignees={assignees}
        modules={modules}
        onSave={(patch) => {
          onUpdate(patch);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const range = formatRange(task.timeline_start, task.timeline_end);
  const cls = ["task", readOnly && "readonly", flags.blocked && "blocked", flags.high && "high"]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cls}
      data-task-id={task.id}
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      tabIndex={readOnly ? undefined : 0}
      onClick={() => !readOnly && setEditing(true)}
      onKeyDown={(e) => {
        if (!readOnly && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      <div className="task-title">{task.title}</div>
      {task.description && <p className="task-desc">{task.description}</p>}
      {flags.blocked && <p className="task-blocked">Terhambat · {task.blocked_reason}</p>}
      <div className="task-meta">
        {flags.high && <span className="prio">Prioritas</span>}
        {task.module && <span className="module">{task.module}</span>}
        {task.target && <span className="target">{task.target}</span>}
        {(range || task.assignee) && (
          <span className="task-foot">
            {range && (
              <time className={flags.overdueDays ? "late" : flags.dueSoon ? "soon" : undefined}>
                {range}
                {flags.overdueDays > 0 && ` · terlambat ${flags.overdueDays} hr`}
                {flags.dueSoon && " · segera"}
              </time>
            )}
            {task.assignee && <span className="assignee">{task.assignee}</span>}
          </span>
        )}
      </div>
      {!readOnly && (
        <button
          className="text icon archive"
          aria-label="Arsipkan task"
          title="Arsipkan"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
        >
          <Archive size={14} />
        </button>
      )}
    </article>
  );
}

/** Compact row for a bucket's collapsible "Diarsipkan" list: no drag, no inline edit, just restore or hard-delete. */
export function ArchivedTaskRow({
  task,
  readOnly,
  onUnarchive,
  onDelete,
}: {
  task: Task;
  readOnly: boolean;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="archived-row">
      <span className="archived-title" title={task.title}>
        {task.title}
      </span>
      {!readOnly && (
        <span className="row">
          <button className="text" onClick={onUnarchive}>
            Pulihkan
          </button>
          <button className="text danger" onClick={onDelete}>
            Hapus
          </button>
        </span>
      )}
    </div>
  );
}

function EditTaskForm({
  task,
  buckets,
  assignees,
  modules,
  onSave,
  onCancel,
}: {
  task: Task;
  buckets: Bucket[];
  assignees: string[];
  modules: string[];
  onSave: (patch: Partial<Task>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [module, setModule] = useState(task.module ?? "");
  const [target, setTarget] = useState(task.target ?? "");
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority ?? "normal");
  const [blocked, setBlocked] = useState(task.blocked_reason ?? "");
  const [timelineStart, setTimelineStart] = useState(task.timeline_start ?? "");
  const [timelineEnd, setTimelineEnd] = useState(task.timeline_end ?? "");
  const [bucketId, setBucketId] = useState(task.bucket_id);

  return (
    <form
      className="task-form"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title,
          description: description || null,
          module: module || null,
          target: target || null,
          assignee: assignee || null,
          priority,
          blocked_reason: blocked || null,
          timeline_start: timelineStart || null,
          timeline_end: timelineEnd || null,
          bucket_id: bucketId,
        });
      }}
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul" required />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi" />
      <div className="row">
        <ModuleSelect modules={modules} value={module} onChange={setModule} />
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" />
      </div>
      <div className="row">
        <label>
          PIC
          <AssigneeSelect assignees={assignees} value={assignee} onChange={setAssignee} />
        </label>
        <label>
          Prioritas
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">Rendah</option>
            <option value="normal">Normal</option>
            <option value="high">Tinggi</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Mulai
          <input type="date" value={timelineStart} onChange={(e) => setTimelineStart(e.target.value)} />
        </label>
        <label>
          Selesai
          <input type="date" value={timelineEnd} onChange={(e) => setTimelineEnd(e.target.value)} />
        </label>
      </div>
      <label>
        Terhambat karena
        <input
          value={blocked}
          onChange={(e) => setBlocked(e.target.value)}
          placeholder="Kosongkan jika tidak terhambat"
        />
      </label>
      <label>
        Kolom
        <select value={bucketId} onChange={(e) => setBucketId(e.target.value)}>
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <button type="submit">Simpan</button>
        <button type="button" className="text" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}
