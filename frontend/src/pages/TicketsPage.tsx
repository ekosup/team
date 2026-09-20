import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { managerApi } from "../api";
import { useStoredKey } from "../hooks/useStoredKey";
import { useDialog } from "../hooks/useDialog";
import type { BoardSummary, Ticket } from "../types";
import { formatDateTime } from "../lib/task";

const PRIORITY_LABEL = { low: "Rendah", normal: "Normal", high: "Tinggi" } as const;
const LIMIT = 20;
type StatusTab = "open" | "accepted" | "rejected" | "all";

/** Standalone ticket inbox: own board picker, status tabs, paginated (LIMIT per page) so it stays usable at hundreds of tickets. */
export function TicketsPage() {
  const { confirm, notify, dialog } = useDialog();
  const [key, setKey] = useStoredKey("team-board:manager-key");
  const [inputKey, setInputKey] = useState(key);
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [params, setParams] = useSearchParams();
  const boardId = params.get("board") ?? "";
  const status = (params.get("status") as StatusTab) || "open";
  const page = Number(params.get("page") ?? "1") || 1;

  const [data, setData] = useState<{ tickets: Ticket[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBoardList = useCallback(() => {
    if (!key) return;
    managerApi
      .listBoards(key)
      .then((res) => {
        setBoards(res.boards);
        setError("");
        if (!boardId && res.boards[0]) {
          const next = new URLSearchParams(params);
          next.set("board", res.boards[0].id);
          setParams(next, { replace: true });
        }
      })
      .catch((e) => setError(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const load = useCallback(() => {
    if (!key || !boardId) return;
    managerApi
      .listTickets(key, boardId, { status, page, limit: LIMIT })
      .then((res) => setData({ tickets: res.tickets, total: res.total }))
      .catch((e) => setError(String(e.message ?? e)));
  }, [key, boardId, status, page]);

  useEffect(loadBoardList, [loadBoardList]);
  useEffect(load, [load]);

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setParams(next);
  };

  const resolve = (ticket: Ticket, action: "accept" | "reject") => {
    setBusyId(ticket.id);
    managerApi
      .resolveTicket(key, boardId, ticket.id, action)
      .then(() => {
        // last item on this page just left the current status filter — step back a page if now empty
        if (data && data.tickets.length === 1 && page > 1) setParam({ page: String(page - 1) });
        else load();
      })
      .catch((e) => notify(e.message, { title: "Gagal memproses tiket" }))
      .finally(() => setBusyId(null));
  };

  if (!key) {
    return (
      <main className="gate">
        <span className="eyebrow">Team Board</span>
        <span className="rule" />
        <h1>Masuk sebagai manager</h1>
        <p>Masukkan access key yang diberikan Admin. Key disimpan di browser ini saja.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setKey(inputKey.trim());
          }}
        >
          <input
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
            aria-label="Access key"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">Masuk</button>
        </form>
      </main>
    );
  }

  if (error) {
    return (
      <main className="gate">
        <span className="eyebrow">Team Board</span>
        <h1>Tidak bisa masuk</h1>
        <p className="error">{error}</p>
        <div className="row">
          <button className="ghost" onClick={() => setKey("")}>
            Ganti access key
          </button>
        </div>
      </main>
    );
  }

  if (!boards) return <main className="gate muted">Memuat…</main>;

  const board = boards.find((b) => b.id === boardId);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Team board</span>
          <div className="row">
            <h1>Tiket masuk</h1>
            {boards.length > 1 && (
              <select
                aria-label="Pilih board"
                value={boardId}
                onChange={(e) => setParam({ board: e.target.value, page: "1" })}
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.team_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <Link className="text inline-link" to="/board">
          <ChevronLeft size={14} /> Ke board
        </Link>
      </header>

      <div className="panels">
        <div className="panels-bar">
          {(["open", "accepted", "rejected", "all"] as StatusTab[]).map((s) => (
            <button
              key={s}
              className={`ghost toggle${status === s ? " on" : ""}`}
              onClick={() => setParam({ status: s, page: "1" })}
            >
              {s === "open" ? "Terbuka" : s === "accepted" ? "Diterima" : s === "rejected" ? "Ditolak" : "Semua"}
            </button>
          ))}
          {board && (
            <a href={`/t/${board.public_slug}`} target="_blank" rel="noreferrer" className="muted">
              Link tiket: /t/{board.public_slug}
            </a>
          )}
        </div>

        {!data ? (
          <p className="muted">Memuat…</p>
        ) : (
          <section className="panel">
            {data.tickets.length === 0 && <p className="muted">Tidak ada tiket di kategori ini.</p>}
            {data.tickets.map((t) => (
              <article key={t.id} className={`ticket ${t.status}`}>
                <div className="ticket-head">
                  <strong>{t.title}</strong>
                  <span className="muted">
                    {t.email} · {formatDateTime(t.created_at)}
                  </span>
                </div>
                {t.description && <p className="task-desc">{t.description}</p>}
                <div className="task-meta">
                  {t.priority === "high" && <span className="prio">Prioritas</span>}
                  {t.module && <span className="module">{t.module}</span>}
                  <span className="muted">{PRIORITY_LABEL[t.priority]}</span>
                </div>
                {t.status === "open" ? (
                  <div className="row">
                    <button disabled={busyId === t.id} onClick={() => resolve(t, "accept")}>
                      Terima ke backlog
                    </button>
                    <button
                      className="text danger"
                      disabled={busyId === t.id}
                      onClick={async () => {
                        if (await confirm(`Tolak tiket "${t.title}"?`, { confirmLabel: "Tolak", danger: true }))
                          resolve(t, "reject");
                      }}
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
                  <span className={`status${t.status === "rejected" ? " off" : ""}`}>
                    {t.status === "accepted" ? "Diterima" : "Ditolak"}
                    {t.resolved_at && ` · ${formatDateTime(t.resolved_at)}`}
                  </span>
                )}
              </article>
            ))}

            {data.total > LIMIT && (
              <div className="pager">
                <button
                  className="ghost inline-link"
                  disabled={page <= 1}
                  onClick={() => setParam({ page: String(page - 1) })}
                >
                  <ChevronLeft size={14} /> Sebelumnya
                </button>
                <span className="muted">
                  Halaman {page} dari {totalPages} · {data.total} tiket
                </span>
                <button
                  className="ghost inline-link"
                  disabled={page >= totalPages}
                  onClick={() => setParam({ page: String(page + 1) })}
                >
                  Berikutnya <ChevronRight size={14} />
                </button>
              </div>
            )}
          </section>
        )}
      </div>
      {dialog}
    </div>
  );
}
