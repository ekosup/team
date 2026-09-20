import { useState } from "react";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_VALUES } from "../types";
import type { Board, ProjectStatus } from "../types";
import { Modal } from "./Modal";

/** Manager-only strip above the kanban: board settings (ticket allow-list, PIC list, project status), in a modal. */
export function BoardPanels({
  board,
  onSaveSettings,
}: {
  board: Board;
  onSaveSettings: (patch: { allowed_emails?: string[]; assignees?: string[]; status?: ProjectStatus }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panels">
      <div className="panels-bar">
        <button className="ghost" onClick={() => setOpen(true)}>
          Pengaturan
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Pengaturan board">
        <SettingsForm
          board={board}
          onSave={(patch) => onSaveSettings(patch).then(() => setOpen(false))}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </div>
  );
}

const lines = (s: string) => [...new Set(s.split("\n").map((l) => l.trim()).filter(Boolean))];

function SettingsForm({
  board,
  onSave,
  onCancel,
}: {
  board: Board;
  onSave: (patch: { allowed_emails?: string[]; assignees?: string[]; status?: ProjectStatus }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [emails, setEmails] = useState(board.allowed_emails.join("\n"));
  const [assignees, setAssignees] = useState(board.assignees.join("\n"));
  const [status, setStatus] = useState<ProjectStatus>(board.status);
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaving(true);
        onSave({
          allowed_emails: lines(emails).map((l) => l.toLowerCase()),
          assignees: lines(assignees),
          status,
        }).finally(() => setSaving(false));
      }}
    >
      <label>
        Status project
        <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
          {PROJECT_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <small className="muted">Muncul di listing project App &gt; Module. Menghapus board tetap hanya lewat Admin.</small>
      </label>
      <label>
        Email yang boleh kirim tiket
        <textarea
          rows={6}
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder={"nama@instansi.go.id\n*@instansi.go.id"}
          spellCheck={false}
        />
        <small className="muted">Satu per baris. Pakai *@domain untuk seluruh domain. Kosong = tiket ditutup.</small>
      </label>
      <label>
        Daftar PIC
        <textarea rows={6} value={assignees} onChange={(e) => setAssignees(e.target.value)} placeholder={"Ekos\nBudi"} />
        <small className="muted">Satu nama per baris. Muncul sebagai pilihan PIC di task.</small>
      </label>
      <div className="dialog-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
