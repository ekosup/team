import { useState } from "react";
import type { Board } from "../types";
import { Modal } from "./Modal";

/** Manager-only strip above the kanban: board settings (ticket allow-list, PIC list), in a modal. */
export function BoardPanels({
  board,
  onSaveSettings,
}: {
  board: Board;
  onSaveSettings: (patch: { allowed_emails?: string[]; assignees?: string[] }) => Promise<unknown>;
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
  onSave: (patch: { allowed_emails?: string[]; assignees?: string[] }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [emails, setEmails] = useState(board.allowed_emails.join("\n"));
  const [assignees, setAssignees] = useState(board.assignees.join("\n"));
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaving(true);
        onSave({ allowed_emails: lines(emails).map((l) => l.toLowerCase()), assignees: lines(assignees) }).finally(() =>
          setSaving(false)
        );
      }}
    >
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
