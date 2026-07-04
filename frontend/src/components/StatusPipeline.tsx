const STAGES = [
  { key: 'pending_review', label: 'Submitted' },
  { key: 'priced', label: 'Priced' },
  { key: 'approved', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'billing_approved', label: 'Billing' },
  { key: 'invoiced', label: 'Invoiced' },
];

export function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center w-full overflow-x-auto py-2">
      {STAGES.map((stage, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={stage.key} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1.5 min-w-[84px]">
              <div
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold font-mono border-2 transition-colors',
                  isDone
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : isCurrent
                      ? 'bg-white border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'bg-white border-[var(--color-concrete-light)] text-[var(--color-concrete)]',
                ].join(' ')}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={[
                  'text-xs text-center leading-tight',
                  isCurrent ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-concrete)]',
                ].join(' ')}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={[
                  'h-0.5 w-8 mx-1 mb-5 flex-shrink-0',
                  isDone ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-concrete-light)]',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
