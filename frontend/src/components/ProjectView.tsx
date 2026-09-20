import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_VALUES } from "../types";
import type { Board, ProjectStatus } from "../types";

/** "App > Module" listing for the manager's current board — same table/expand layout as Admin's Daftar Project.
 *  CRU on the curated module list (no delete: rename an entry instead of removing it, so tasks that still
 *  reference the old name don't look orphaned). */
export function ProjectView({
  board,
  onSaveModules,
  onSaveStatus,
}: {
  board: Board;
  onSaveModules: (modules: string[]) => Promise<unknown>;
  onSaveStatus: (status: ProjectStatus) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(true);
  const [newModule, setNewModule] = useState("");
  const [saving, setSaving] = useState(false);

  const activeTasks = board.tasks.filter((t) => !t.archived_at);
  const countFor = (name: string) => activeTasks.filter((t) => t.module === name).length;

  const saveModules = (next: string[]) => {
    setSaving(true);
    onSaveModules(next).finally(() => setSaving(false));
  };

  return (
    <section className="kanban">
      <h2>Daftar Project</h2>
      <table className="table">
        <thead>
          <tr>
            <th className="col-expand" style={{ width: "32px" }}></th>
            <th>App</th>
            <th>Status</th>
            <th>Module</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="actions">
              <button
                className="text icon"
                aria-label={open ? "Sembunyikan module" : "Tampilkan module"}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </td>
            <td>{board.team_name}</td>
            <td>
              <select
                aria-label={`Status project ${board.team_name}`}
                value={board.status}
                onChange={(e) => onSaveStatus(e.target.value as ProjectStatus)}
              >
                {PROJECT_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </td>
            <td>{board.modules.length}</td>
          </tr>
          {open && (
            <tr>
              <td></td>
              <td colSpan={3}>
                {board.modules.length === 0 ? (
                  <span className="muted">Belum ada module.</span>
                ) : (
                  <dl className="ledger">
                    {board.modules.map((name, i) => (
                      <div key={i}>
                        <dt>
                          <ModuleNameInput
                            name={name}
                            onRename={(next) => {
                              if (!next || next === name || board.modules.includes(next)) return;
                              const modules = [...board.modules];
                              modules[i] = next;
                              saveModules(modules);
                            }}
                          />
                        </dt>
                        <dd>{countFor(name)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <form
                  className="row"
                  style={{ marginTop: "var(--space-md)" }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = newModule.trim();
                    if (!name || board.modules.includes(name)) return;
                    saveModules([...board.modules, name]);
                    setNewModule("");
                  }}
                >
                  <input
                    aria-label="Module baru"
                    placeholder="Module baru"
                    value={newModule}
                    onChange={(e) => setNewModule(e.target.value)}
                  />
                  <button type="submit" disabled={saving || !newModule.trim()}>
                    Tambah module
                  </button>
                </form>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function ModuleNameInput({ name, onRename }: { name: string; onRename: (next: string) => void }) {
  const [value, setValue] = useState(name);

  return (
    <input
      aria-label={`Nama module ${name}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onRename(value.trim())}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
