import { useEffect, useRef } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape-to-close. Skipped while a confirm action is in flight so a
  // slow request can't be dismissed mid-submit.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-ink)]/40 animate-backdrop-in"
      onMouseDown={(e) => {
        // Outside-click to close: only when the mousedown started on the
        // backdrop itself, not when it started inside the dialog and
        // dragged out (e.g. selecting message text).
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md p-6 bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] animate-dialog-in"
        style={{ boxShadow: 'var(--elevation-3)' }}
      >
        <h3
          id="confirm-dialog-title"
          className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-concrete)]">
          {message}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
