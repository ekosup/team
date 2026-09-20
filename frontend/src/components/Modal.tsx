import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog>-backed modal: free focus trap, Esc-to-close, and ::backdrop dimming. */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) onClose();
      }}
    >
      {title && <h2>{title}</h2>}
      {children}
    </dialog>
  );
}
