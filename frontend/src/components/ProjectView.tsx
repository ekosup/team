import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_VALUES } from "../types";
import type { Board, BoardModule, ProjectStatus } from "../types";

/** "App > Module" listing for the manager's current board — same table/expand layout as Admin's Daftar Project.
 *  CRU on the curated module list (no delete: rename an entry instead of removing it, so tasks that still
 *  reference the old name don't look orphaned). Pass `readOnly` to render the same table without editing
 *  affordances (used on the public guest board). */
export function ProjectView({
  board,
  onSaveModules,
  onSaveStatus,
  readOnly = false,
}: {
  board: Board;
  onSaveModules?: (modules: BoardModule[]) => Promise<unknown>;
  onSaveStatus?: (status: ProjectStatus) => Promise<unknown>;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [newModule, setNewModule] = useState("");
  const [saving, setSaving] = useState(false);

  const activeTasks = board.tasks.filter((t) => !t.archived_at);
  const countFor = (name: string) => activeTasks.filter((t) => t.module === name).length;

  const saveModules = (next: BoardModule[]) => {
    if (!onSaveModules) return;
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
          <tr className="row-align-middle">
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
              {readOnly ? (
                PROJECT_STATUS_LABELS[board.status]
              ) : (
                <select
                  aria-label={`Status project ${board.team_name}`}
                  value={board.status}
                  onChange={(e) => onSaveStatus?.(e.target.value as ProjectStatus)}
                >
                  {PROJECT_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              )}
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
                  <dl className="ledger ledger-modules">
                    {board.modules.map((m, i) => (
                      <div key={i}>
                        <dt>
                          {readOnly ? (
                            <span className="module-name">{m.name}</span>
                          ) : (
                            <ModuleNameInput
                              name={m.name}
                              onRename={(next) => {
                                if (!next || next === m.name || board.modules.some((x) => x.name === next)) return;
                                const modules = [...board.modules];
                                modules[i] = { ...modules[i], name: next };
                                saveModules(modules);
                              }}
                            />
                          )}
                          {readOnly ? (
                            m.description && <p className="module-desc muted">{m.description}</p>
                          ) : (
                            <ModuleDescriptionInput
                              description={m.description}
                              onSave={(next) => {
                                if (next === m.description) return;
                                const modules = [...board.modules];
                                modules[i] = { ...modules[i], description: next };
                                saveModules(modules);
                              }}
                            />
                          )}
                        </dt>
                        <dd>
                          <span className="badge">{countFor(m.name)} Task</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {!readOnly && (
                  <form
                    className="row new-module"
                    style={{ marginTop: "var(--space-md)" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = newModule.trim();
                      if (!name || board.modules.some((m) => m.name === name)) return;
                      saveModules([...board.modules, { name, description: "" }]);
                      setNewModule("");
                    }}
                  >
                    <input
                      aria-label="Module baru"
                      placeholder="Module baru"
                      value={newModule}
                      onChange={(e) => setNewModule(e.target.value)}
                    />
                    {newModule.trim() && (
                      <button type="submit" disabled={saving}>
                        Tambah module
                      </button>
                    )}
                  </form>
                )}
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
      className="module-name"
      aria-label={`Nama module ${name}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onRename(value.trim())}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function ModuleDescriptionInput({ description, onSave }: { description: string; onSave: (next: string) => void }) {
  const [value, setValue] = useState(description);

  return (
    <input
      className="module-desc"
      aria-label={`Deskripsi singkat module`}
      placeholder="Deskripsi singkat…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value.trim())}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
