import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastTone = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  leaving?: boolean;
}

interface ToastContextValue {
  /** Fire a transient success confirmation, e.g. after savePrice succeeds. */
  showSuccess: (message: string) => void;
  /** Fire a transient error notice for an action that failed. Reserve
   *  inline banners for persistent, page-level failures (e.g. "couldn't
   *  load data") — use this for one-off action failures instead. */
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;
const LEAVE_ANIMATION_MS = 150;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    // Mark as leaving first so the CSS exit animation plays, then remove
    // from state once it's finished rather than popping it instantly.
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, LEAVE_ANIMATION_MS);
  }, []);

  const push = useCallback((message: string, tone: ToastTone) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const showSuccess = useCallback((message: string) => push(message, 'success'), [push]);
  const showError = useCallback((message: string) => push(message, 'error'), [push]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 bg-[var(--color-panel)] ${
              t.leaving ? 'animate-toast-out' : 'animate-toast-in'
            } ${
              t.tone === 'success'
                ? 'border-[var(--color-success)]/30'
                : 'border-[var(--color-danger)]/30'
            }`}
            style={{ boxShadow: 'var(--elevation-2)' }}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 size={18} className="text-[var(--color-success)] mt-0.5 shrink-0" />
            ) : (
              <XCircle size={18} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
            )}
            <p className="text-sm text-[var(--color-ink)] flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-[var(--color-concrete)] hover:text-[var(--color-ink)] shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
