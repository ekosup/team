import { useCallback, useState } from "react";
import { Modal } from "../components/Modal";

type ConfirmOpts = { title?: string; confirmLabel?: string; danger?: boolean };
type AlertOpts = { title?: string };

type DialogState =
  | { kind: "confirm"; message: string; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "alert"; message: string; opts: AlertOpts; resolve: () => void }
  | null;

/**
 * Promise-based replacement for window.confirm/alert, styled like the rest of the app.
 * Render the returned `dialog` once per page; call `confirm`/`notify` from anywhere in that page.
 */
export function useDialog() {
  const [state, setState] = useState<DialogState>(null);

  const confirm = useCallback(
    (message: string, opts: ConfirmOpts = {}) => new Promise<boolean>((resolve) => setState({ kind: "confirm", message, opts, resolve })),
    []
  );

  const notify = useCallback(
    (message: string, opts: AlertOpts = {}) => new Promise<void>((resolve) => setState({ kind: "alert", message, opts, resolve })),
    []
  );

  const settle = (result: boolean) => {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(result);
    else state.resolve();
    setState(null);
  };

  const dialog = (
    <Modal open={!!state} onClose={() => settle(false)} title={state?.opts.title ?? (state?.kind === "confirm" ? "Konfirmasi" : "Info")}>
      <p>{state?.message}</p>
      <div className="dialog-actions">
        {state?.kind === "confirm" && (
          <button className="ghost" onClick={() => settle(false)}>
            Batal
          </button>
        )}
        <button className={state?.kind === "confirm" && state.opts.danger ? "danger" : undefined} onClick={() => settle(true)} autoFocus>
          {state?.kind === "confirm" ? (state.opts.confirmLabel ?? "Ya") : "OK"}
        </button>
      </div>
    </Modal>
  );

  return { confirm, notify, dialog };
}
