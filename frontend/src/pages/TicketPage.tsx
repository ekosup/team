import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api";
import type { Priority } from "../types";

/** Public one-way ticket form. Anyone with the link can open it; the email must match the board's allow-list. */
export function TicketPage() {
  const { slug = "" } = useParams();
  const [info, setInfo] = useState<{ team_name: string; modules: string[] } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState(() => localStorage.getItem("team-board:ticket-email") ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    publicApi
      .getTicketInfo(slug)
      .then(setInfo)
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, [slug]);

  if (loadError) {
    return (
      <main className="gate">
        <span className="eyebrow">Team Board</span>
        <h1>Board tidak ditemukan</h1>
        <p>Link tiket ini tidak aktif. Minta link baru ke manager board.</p>
      </main>
    );
  }
  if (!info) return <main className="gate muted">Memuat…</main>;

  if (sent) {
    return (
      <main className="gate">
        <span className="eyebrow">{info.team_name}</span>
        <span className="rule" />
        <h1>Tiket terkirim</h1>
        <p>Manager akan meninjau dan memasukkannya ke board jika diterima. Tidak ada notifikasi balik ke email.</p>
        <div className="row">
          <button
            className="ghost"
            onClick={() => {
              setTitle("");
              setDescription("");
              setSent(false);
            }}
          >
            Kirim tiket lain
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="gate">
      <span className="eyebrow">{info.team_name}</span>
      <span className="rule" />
      <h1>Buat tiket</h1>
      <p>Isi dengan email kantor yang terdaftar di board ini. Tiket masuk ke antrian manager, bukan langsung ke board.</p>
      <form
        className="ticket-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSending(true);
          setError("");
          localStorage.setItem("team-board:ticket-email", email.trim());
          publicApi
            .createTicket(slug, {
              email: email.trim(),
              title: title.trim(),
              description: description.trim() || undefined,
              module: module || undefined,
              priority,
            })
            .then(() => setSent(true))
            .catch((e) => setError(String(e.message ?? e)))
            .finally(() => setSending(false));
        }}
      >
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              e.target.setCustomValidity("");
              setEmail(e.target.value);
            }}
            onInvalid={(e) =>
              e.currentTarget.setCustomValidity("Masukkan alamat email yang valid, misalnya nama@instansi.go.id")
            }
            placeholder="nama@instansi.go.id"
          />
        </label>
        <label>
          Judul
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ringkas masalah atau permintaan" />
        </label>
        <label>
          Deskripsi
          <textarea rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detail, langkah, dampak" />
        </label>
        <div className="row">
          <label>
            Module
            <select value={module} onChange={(e) => setModule(e.target.value)}>
              <option value="">—</option>
              {info.modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
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
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={sending}>
            {sending ? "Mengirim…" : "Kirim tiket"}
          </button>
        </div>
      </form>
    </main>
  );
}
