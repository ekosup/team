import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { adminApi } from "../api";
import { useStoredKey } from "../hooks/useStoredKey";
import { useDialog } from "../hooks/useDialog";
import type { BoardSummary, Manager, Stats } from "../types";

/** Preserves row order (backend already sorts by board_name) while clustering rows under their board. */
function groupByBoard<T extends { board_name: string }>(rows: T[]): [string, T[]][] {
  const groups: [string, T[]][] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last[0] === row.board_name) last[1].push(row);
    else groups.push([row.board_name, [row]]);
  }
  return groups;
}

export function AdminPage() {
  const { confirm, dialog } = useDialog();
  const [key, setKey] = useStoredKey("team-board:admin-key");
  const [inputKey, setInputKey] = useState(key);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [newManagerName, setNewManagerName] = useState("");
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardManagerIds, setNewBoardManagerIds] = useState<string[]>([]);
  const [lastIssuedKey, setLastIssuedKey] = useState<{ who: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!key) return;
    Promise.all([adminApi.listManagers(key), adminApi.listBoards(key), adminApi.stats(key)])
      .then(([m, b, s]) => {
        setManagers(m.managers);
        setBoards(b.boards);
        setStats(s);
        setError("");
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [key]);

  useEffect(load, [load]);

  const activeManagers = managers.filter((m) => !m.revoked_at);

  if (!key) {
    return (
      <main className="gate">
        <span className="eyebrow">Team Board</span>
        <span className="rule" />
        <h1>Masuk sebagai admin</h1>
        <p>Pakai admin API key. Key disimpan di browser ini saja.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setKey(inputKey.trim());
          }}
        >
          <input
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Admin API key"
            aria-label="Admin API key"
            type="password"
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
            Ganti key
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="admin">
      <header className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Team board</span>
          <h1>Admin</h1>
        </div>
        <button className="text" onClick={() => setKey("")}>
          Keluar
        </button>
      </header>

      <section>
        <h2>Ringkasan</h2>
        {stats && (
          <div className="ledger-grid">
            <dl className="ledger">
              <span className="eyebrow">Total</span>
              <div>
                <dt>Board</dt>
                <dd className="headline">{stats.board_count}</dd>
              </div>
              <div>
                <dt>Manager aktif</dt>
                <dd className="headline">{stats.active_manager_count}</dd>
              </div>
            </dl>
            <dl className="ledger">
              <span className="eyebrow">Task per kolom</span>
              {stats.tasks_by_bucket.length === 0 && (
                <div>
                  <dt className="muted">Belum ada task</dt>
                </div>
              )}
              {groupByBoard(stats.tasks_by_bucket).map(([boardName, rows]) => (
                <div className="ledger-group" key={boardName}>
                  <span className="ledger-group-label">{boardName}</span>
                  {rows.map((r, i) => (
                    <div key={`${r.bucket_name}-${i}`}>
                      <dt>{r.bucket_name}</dt>
                      <dd>{r.count}</dd>
                    </div>
                  ))}
                </div>
              ))}
            </dl>
            <dl className="ledger">
              <span className="eyebrow">Task per module</span>
              {stats.tasks_by_module.length === 0 && (
                <div>
                  <dt className="muted">Belum ada module</dt>
                </div>
              )}
              {groupByBoard(stats.tasks_by_module).map(([boardName, rows]) => (
                <div className="ledger-group" key={boardName}>
                  <span className="ledger-group-label">{boardName}</span>
                  {rows.map((r, i) => (
                    <div key={`${r.module}-${i}`}>
                      <dt>{r.module}</dt>
                      <dd>{r.count}</dd>
                    </div>
                  ))}
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      <section>
        <h2>Manager</h2>
        <div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newManagerName.trim()) return;
              adminApi.createManager(key, newManagerName.trim()).then((res) => {
                setLastIssuedKey({ who: res.manager.name, key: res.access_key });
                setCopied(false);
                setNewManagerName("");
                load();
              });
            }}
          >
            <input
              placeholder="Nama manager"
              aria-label="Nama manager"
              value={newManagerName}
              onChange={(e) => setNewManagerName(e.target.value)}
            />
            <button type="submit">Buat access key</button>
          </form>

          {lastIssuedKey && (
            <div className="key-reveal" role="status">
              <div>
                <span className="eyebrow">Access key · {lastIssuedKey.who}</span>
                <code>{lastIssuedKey.key}</code>
              </div>
              <button
                className="ghost"
                onClick={() => navigator.clipboard.writeText(lastIssuedKey.key).then(() => setCopied(true))}
              >
                {copied ? "Tersalin" : "Salin"}
              </button>
              <button className="text icon" aria-label="Tutup" onClick={() => setLastIssuedKey(null)}>
                <X size={14} />
              </button>
              <small>Simpan sekarang. Key ini tidak ditampilkan lagi setelah ditutup.</small>
            </div>
          )}

          <table className="table" style={{ marginTop: "var(--space-xl)" }}>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {managers.length === 0 && (
                <tr className="empty">
                  <td colSpan={3}>Belum ada manager. Buat satu di atas untuk mendapatkan access key.</td>
                </tr>
              )}
              {managers.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>
                    <span className={`status${m.revoked_at ? " off" : ""}`}>
                      {m.revoked_at ? "Dicabut" : "Aktif"}
                    </span>
                  </td>
                  <td className="actions">
                    <button
                      className="text"
                      onClick={() =>
                        adminApi.rotateManagerKey(key, m.id).then((res) => {
                          setLastIssuedKey({ who: m.name, key: res.access_key });
                          setCopied(false);
                          load();
                        })
                      }
                    >
                      Rotasi key
                    </button>
                    {!m.revoked_at && (
                      <button
                        className="text danger"
                        onClick={async () => {
                          if (await confirm(`Cabut akses ${m.name}?`, { confirmLabel: "Cabut", danger: true }))
                            adminApi.revokeManager(key, m.id).then(load);
                        }}
                      >
                        Cabut
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Board</h2>
        <div>
          <form
            className="new-board"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newBoardName.trim() || newBoardManagerIds.length === 0) return;
              adminApi.createBoard(key, newBoardName.trim(), newBoardManagerIds).then(() => {
                setNewBoardName("");
                setNewBoardManagerIds([]);
                load();
              });
            }}
          >
            <input
              placeholder="Nama tim"
              aria-label="Nama tim"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
            />
            <span className="eyebrow">Manager</span>
            {activeManagers.length === 0 ? (
              <p className="muted">Buat manager dulu. Board harus punya minimal satu manager.</p>
            ) : (
              <div className="checkboxes">
                {activeManagers.map((m) => (
                  <label key={m.id} className="checkbox">
                    <input
                      type="checkbox"
                      checked={newBoardManagerIds.includes(m.id)}
                      onChange={(e) =>
                        setNewBoardManagerIds((prev) =>
                          e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                        )
                      }
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
            <div className="row">
              <button type="submit" disabled={!newBoardName.trim() || newBoardManagerIds.length === 0}>
                Buat board
              </button>
            </div>
          </form>

          <table className="table" style={{ marginTop: "var(--space-2xl)" }}>
            <thead>
              <tr>
                <th>Tim</th>
                <th>Manager</th>
                <th>Link publik</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {boards.length === 0 && (
                <tr className="empty">
                  <td colSpan={4}>Belum ada board.</td>
                </tr>
              )}
              {boards.map((b) => (
                <tr key={b.id}>
                  <td>{b.team_name}</td>
                  <td>
                    <div className="checkboxes">
                      {activeManagers.map((m) => {
                        const assigned = b.managers.some((bm) => bm.id === m.id);
                        return (
                          <label key={m.id} className="checkbox">
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={(e) => {
                                const nextIds = e.target.checked
                                  ? [...b.managers.map((bm) => bm.id), m.id]
                                  : b.managers.map((bm) => bm.id).filter((id) => id !== m.id);
                                if (nextIds.length === 0) return;
                                adminApi.patchBoard(key, b.id, { manager_ids: nextIds }).then(load);
                              }}
                            />
                            {m.name}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    {b.is_public ? (
                      <a href={`/p/${b.public_slug}`} target="_blank" rel="noreferrer">
                        /p/{b.public_slug}
                      </a>
                    ) : (
                      <span className="muted">Privat</span>
                    )}
                  </td>
                  <td className="actions">
                    <button
                      className="text"
                      onClick={() => adminApi.patchBoard(key, b.id, { is_public: !b.is_public }).then(load)}
                    >
                      {b.is_public ? "Jadikan privat" : "Jadikan publik"}
                    </button>
                    <button
                      className="text danger"
                      onClick={async () => {
                        if (await confirm(`Hapus board "${b.team_name}"?`, { confirmLabel: "Hapus", danger: true }))
                          adminApi.deleteBoard(key, b.id).then(load);
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {dialog}
    </div>
  );
}
