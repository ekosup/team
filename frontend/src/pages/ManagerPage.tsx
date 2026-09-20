import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { managerApi } from "../api";
import { KanbanBoard } from "../components/KanbanBoard";
import { BoardPanels } from "../components/BoardPanels";
import { ProjectView } from "../components/ProjectView";
import { DocsView } from "../components/DocsView";
import { useStoredKey } from "../hooks/useStoredKey";
import { useDialog } from "../hooks/useDialog";
import type { Board, BoardSummary, Bucket, Doc, Task } from "../types";

export function ManagerPage() {
  const { confirm, notify, dialog } = useDialog();
  const [key, setKey] = useStoredKey("team-board:manager-key");
  const [inputKey, setInputKey] = useState(key);
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [error, setError] = useState("");
  const [view, setView] = useState<"board" | "project" | "docs">("board");
  const [docs, setDocs] = useState<Doc[]>([]);

  const loadBoardList = useCallback(() => {
    if (!key) return;
    managerApi
      .listBoards(key)
      .then((res) => {
        setBoards(res.boards);
        setError("");
        setSelectedBoardId((prev) => prev || res.boards[0]?.id || "");
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [key]);

  const loadBoard = useCallback(() => {
    if (!key || !selectedBoardId) return;
    Promise.all([
      managerApi.getBoard(key, selectedBoardId),
      managerApi.listTickets(key, selectedBoardId, { status: "open", limit: 1 }),
    ])
      .then(([b, t]) => {
        setBoard(b.board);
        setOpenTicketCount(t.total);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [key, selectedBoardId]);

  const loadDocs = useCallback(() => {
    if (!key || !selectedBoardId) return;
    managerApi.listDocs(key, selectedBoardId).then((res) => setDocs(res.docs), () => setDocs([]));
  }, [key, selectedBoardId]);

  useEffect(loadBoardList, [loadBoardList]);
  useEffect(loadBoard, [loadBoard]);
  useEffect(loadDocs, [loadDocs]);

  // write failed: show the server message, then resync so optimistic state is discarded
  const fail = (e: Error) => {
    notify(e.message, { title: "Gagal menyimpan" });
    loadBoard();
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

  if (boards.length === 0) {
    return (
      <main className="gate">
        <span className="eyebrow">Team Board</span>
        <h1>Belum ada board</h1>
        <p>Access key ini valid, tapi belum ada board yang di-assign. Hubungi Admin.</p>
        <div className="row">
          <button className="ghost" onClick={() => setKey("")}>
            Keluar
          </button>
        </div>
      </main>
    );
  }

  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Team board</span>
          <h1>{board?.team_name ?? "…"}</h1>
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
            <button
              className={`ghost toggle${view === "docs" ? " on" : ""}`}
              aria-pressed={view === "docs"}
              onClick={() => setView("docs")}
            >
              Docs
            </button>
          </div>
          <div className="row">
            {boards.length > 1 && (
              <label className="select-label">
                Project
                <select
                  value={selectedBoardId}
                  onChange={(e) => {
                    setBoard(null);
                    setSelectedBoardId(e.target.value);
                  }}
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.team_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Link className="text" to={`/board/tickets?board=${selectedBoardId}`}>
              Tiket masuk{openTicketCount > 0 && <span className="badge">{openTicketCount}</span>}
            </Link>
            <button className="text" onClick={() => setKey("")}>
              Keluar
            </button>
          </div>
        </div>
      </header>

      {!board ? (
        <div className="kanban muted">Memuat…</div>
      ) : view === "project" ? (
        <ProjectView
          board={board}
          onSaveModules={(modules) => managerApi.patchSettings(key, board.id, { modules }).then(loadBoard, fail)}
          onSaveStatus={(status) => managerApi.patchSettings(key, board.id, { status }).then(loadBoard, fail)}
        />
      ) : view === "docs" ? (
        <DocsView
          docs={docs}
          onOpen={(id) => managerApi.getDoc(key, board.id, id).then((r) => r.doc)}
          onCreate={() =>
            managerApi.createDoc(key, board.id, { title: "Tanpa judul", content: "" }).then((r) => {
              loadDocs();
              return r.doc;
            })
          }
          onSaveContent={(id, content) => managerApi.patchDoc(key, board.id, id, { content }).then(loadDocs, fail)}
          onRename={(id, title) => managerApi.patchDoc(key, board.id, id, { title }).then(loadDocs, fail)}
          onToggleSecret={(id, is_secret) =>
            managerApi.patchDoc(key, board.id, id, { is_secret }).then(loadDocs, fail)
          }
          onDelete={async (doc) => {
            if (await confirm(`Hapus dokumen "${doc.title}"? Tidak bisa dibatalkan.`, { confirmLabel: "Hapus", danger: true }))
              managerApi.deleteDoc(key, board.id, doc.id).then(loadDocs, fail);
          }}
        />
      ) : (
        <>
        <BoardPanels
          board={board}
          onSaveSettings={(patch) => managerApi.patchSettings(key, board.id, patch).then(loadBoard, fail)}
        />
        <KanbanBoard
          board={board}
          readOnly={false}
          onCreateBucket={(name) => managerApi.createBucket(key, board.id, name).then(loadBoard, fail)}
          onRenameBucket={(bucket: Bucket, name) =>
            managerApi.patchBucket(key, board.id, bucket.id, { name }).then(loadBoard, fail)
          }
          onMoveBucket={(bucket: Bucket, dir) => {
            const ids = [...board.buckets].sort((a, b) => a.position - b.position).map((b) => b.id);
            const from = ids.indexOf(bucket.id);
            const to = from + dir;
            if (to < 0 || to >= ids.length) return;
            ids.splice(from, 1);
            ids.splice(to, 0, bucket.id);
            setBoard({ ...board, buckets: board.buckets.map((b) => ({ ...b, position: ids.indexOf(b.id) })) });
            managerApi.reorderBuckets(key, board.id, ids).then(loadBoard, fail);
          }}
          onDeleteBucket={async (bucket: Bucket) => {
            if (await confirm(`Hapus kolom "${bucket.name}"?`, { confirmLabel: "Hapus", danger: true }))
              managerApi.deleteBucket(key, board.id, bucket.id).then(loadBoard, fail);
          }}
          onCreateTask={(bucketId, input) =>
            managerApi.createTask(key, board.id, { ...input, bucket_id: bucketId }).then(loadBoard, fail)
          }
          onUpdateTask={(task: Task, patch) =>
            managerApi.patchTask(key, board.id, task.id, patch).then(loadBoard, fail)
          }
          onArchiveTask={(task: Task) => managerApi.archiveTask(key, board.id, task.id).then(loadBoard, fail)}
          onUnarchiveTask={(task: Task) => managerApi.unarchiveTask(key, board.id, task.id).then(loadBoard, fail)}
          onDeleteTask={async (task: Task) => {
            if (await confirm(`Hapus task "${task.title}" secara permanen? Tidak bisa dibatalkan.`, { confirmLabel: "Hapus", danger: true }))
              managerApi.deleteTask(key, board.id, task.id).then(loadBoard, fail);
          }}
          onReorderTasks={(bucketId, ids) => {
            setBoard({
              ...board,
              tasks: board.tasks.map((t) =>
                ids.includes(t.id) ? { ...t, bucket_id: bucketId, position: ids.indexOf(t.id) } : t
              ),
            });
            managerApi.reorderTasks(key, board.id, bucketId, ids).then(loadBoard, fail);
          }}
        />
        </>
      )}
      {dialog}
    </div>
  );
}
