import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  FileText,
  Heading1,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  Plus,
  Quote,
  Trash2,
} from "lucide-react";
import type { Doc } from "../types";

const TOOLBAR_ITEMS: {
  label: string;
  icon: typeof Bold;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
}[] = [
  { label: "Bold", icon: Bold, isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  {
    label: "Italic",
    icon: Italic,
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: "Heading 1",
    icon: Heading1,
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    icon: Heading2,
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Bullet list",
    icon: List,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    icon: ListOrdered,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Checklist",
    icon: ListChecks,
    isActive: (e) => e.isActive("taskList"),
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    label: "Code block",
    icon: Code,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: "Quote",
    icon: Quote,
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
];

/** Minimal always-visible toolbar so formatting isn't hidden behind slash-commands the user has to guess. */
function DocsToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="docs-toolbar">
      {TOOLBAR_ITEMS.map(({ label, icon: Icon, isActive, run }) => (
        <button
          key={label}
          type="button"
          className={`text icon${isActive(editor) ? " on" : ""}`}
          aria-label={label}
          title={label}
          onClick={() => run(editor)}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

const emptyDoc: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function parseContent(content: string | null): JSONContent {
  if (!content) return emptyDoc;
  try {
    return JSON.parse(content);
  } catch {
    return emptyDoc;
  }
}

/** Team knowledge repo: a Notion-like block editor per board. Secret docs store AES-GCM ciphertext server-side
 *  and never ship their content on the list call — the content only arrives once a doc is opened (`onOpen`). */
export function DocsView({
  docs,
  readOnly = false,
  onOpen,
  onCreate,
  onSaveContent,
  onRename,
  onToggleSecret,
  onDelete,
}: {
  docs: Doc[];
  readOnly?: boolean;
  onOpen: (id: string) => Promise<Doc>;
  onCreate?: () => Promise<Doc>;
  onSaveContent?: (id: string, content: string) => void;
  onRename?: (id: string, title: string) => void;
  onToggleSecret?: (id: string, is_secret: boolean) => void;
  onDelete?: (doc: Doc) => void;
}) {
  const sorted = [...docs].sort((a, b) => a.position - b.position);
  const [activeId, setActiveId] = useState(sorted[0]?.id ?? "");
  const [active, setActive] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (activeId && !sorted.some((d) => d.id === activeId)) setActiveId(sorted[0]?.id ?? "");
  }, [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId) {
      setActive(null);
      return;
    }
    setLoading(true);
    onOpen(activeId)
      .then(setActive)
      .finally(() => setLoading(false));
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: "Tulis dokumentasi di sini…" }),
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      editable: !readOnly,
      content: emptyDoc,
      onUpdate: ({ editor }) => {
        if (!active || !onSaveContent) return;
        clearTimeout(saveTimer.current);
        const id = active.id;
        saveTimer.current = setTimeout(() => onSaveContent(id, JSON.stringify(editor.getJSON())), 600);
      },
    },
    []
  );

  useEffect(() => {
    if (editor && active) editor.commands.setContent(parseContent(active.content));
  }, [editor, active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="kanban docs-view">
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div className="docs-sidebar-head">
            <h2>Docs</h2>
            {!readOnly && onCreate && (
              <button
                className="text icon"
                aria-label="Dokumen baru"
                onClick={() => onCreate().then((doc) => setActiveId(doc.id))}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          {sorted.length === 0 ? (
            <p className="muted">Belum ada dokumen.</p>
          ) : (
            <ul className="docs-list">
              {sorted.map((d) => (
                <li key={d.id}>
                  <button
                    className={`docs-list-item${d.id === activeId ? " on" : ""}`}
                    onClick={() => setActiveId(d.id)}
                  >
                    <FileText size={14} />
                    <span>{d.title}</span>
                    {d.is_secret === 1 && <Lock size={12} className="docs-lock" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="docs-content">
          {loading ? (
            <p className="muted">Memuat…</p>
          ) : !active ? (
            <p className="muted">Pilih atau buat dokumen.</p>
          ) : (
            <>
              <div className="docs-content-head">
                {readOnly ? (
                  <h3>{active.title}</h3>
                ) : (
                  <input
                    className="docs-title-input"
                    aria-label="Judul dokumen"
                    value={active.title}
                    onChange={(e) => setActive({ ...active, title: e.target.value })}
                    onBlur={() => onRename?.(active.id, active.title.trim() || "Tanpa judul")}
                  />
                )}
                {!readOnly && (
                  <div className="row">
                    <button
                      className={`ghost toggle${active.is_secret ? " on" : ""}`}
                      aria-pressed={active.is_secret === 1}
                      onClick={() => {
                        const next = active.is_secret !== 1;
                        setActive({ ...active, is_secret: next ? 1 : 0 });
                        onToggleSecret?.(active.id, next);
                      }}
                    >
                      <Lock size={12} /> Secret
                    </button>
                    <button className="text danger icon" aria-label="Hapus dokumen" onClick={() => onDelete?.(active)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              {!readOnly && editor && <DocsToolbar editor={editor} />}
              <EditorContent editor={editor} className="docs-editor" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
