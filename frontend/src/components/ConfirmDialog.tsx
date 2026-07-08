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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-ink)]/40">
      <div className="w-full max-w-md p-6 bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] shadow-2xl">
        <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
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
