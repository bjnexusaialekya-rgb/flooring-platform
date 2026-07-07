import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-[var(--color-ink)] mb-1">{title}</p>
      {description && (
        <p className="text-xs text-[var(--color-concrete)] max-w-sm">{description}</p>
      )}
    </div>
  );
}

export function TableSkeleton({ columns = 5, rows = 4 }: { columns?: number; rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="border-b border-[var(--color-concrete-light)] px-5 py-3 flex gap-6">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 bg-[var(--color-concrete-light)] rounded w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b last:border-0 border-[var(--color-concrete-light)] px-5 py-4 flex gap-6">
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="h-3 bg-[var(--color-concrete-light)] rounded"
              style={{ width: c === 0 ? '4rem' : '5rem' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MetricCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'success' }) {
  const toneClass =
    tone === 'danger'
      ? 'text-[var(--color-danger)]'
      : tone === 'success'
      ? 'text-[var(--color-success)]'
      : 'text-[var(--color-ink)]';
  return (
    <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-concrete)] mb-1.5">{label}</p>
      <p className={`font-[var(--font-mono)] text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
