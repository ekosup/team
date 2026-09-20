import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { publicApi } from "../api";
import { KanbanBoard } from "../components/KanbanBoard";
import { ProjectView } from "../components/ProjectView";
import type { Board } from "../types";
import { formatDateTime } from "../lib/task";

export function GuestPage() {
  const { slug = "" } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"board" | "project">("board");

  useEffect(() => {
    publicApi
      .getBoard(slug)
      .then((res) => setBoard(res.board))
      .catch((e) => setError(String(e.message ?? e)));
  }, [slug]);

  if (error) {
    return (
      <main className="gate">
        <span className="eyebrow">Team Board</span>
        <h1>Board tidak tersedia</h1>
        <p>Link ini tidak aktif atau board sudah dibuat privat. Minta link baru ke pemilik board.</p>
      </main>
    );
  }
  if (!board) return <main className="gate muted">Memuat…</main>;

  const lastUpdated = board.tasks.map((t) => t.updated_at).sort().at(-1);

  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Team board</span>
          <h1>{board.team_name}</h1>
        </div>
        <div className="topbar-actions">
          <div className="row">
            <button
              className={`ghost toggle${view === "board" ? " on" : ""}`}
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
            >
              Board
            </button>
            <button
              className={`ghost toggle${view === "project" ? " on" : ""}`}
              aria-pressed={view === "project"}
              onClick={() => setView("project")}
            >
              Project
            </button>
          </div>
          <div className="topbar-side">
            <span className="eyebrow">Hanya lihat</span>
            {lastUpdated && <span className="muted">Diperbarui {formatDateTime(lastUpdated)}</span>}
            {board.tickets_enabled && (
              <Link className="inline-link" to={`/t/${slug}`}>
                Buat tiket <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </header>
      {view === "project" ? <ProjectView board={board} readOnly /> : <KanbanBoard board={board} readOnly />}
    </div>
  );
}
