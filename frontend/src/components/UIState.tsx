import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

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

// Metric-card tone -> icon-chip token map. Kept separate from the
// work-order STATUS_* tokens in statusColors.ts on purpose (a "Total"
// or "Revenue" metric card isn't a work-order status) — see the
// --color-chip-* block in index.css.
export type MetricTone = 'default' | 'total' | 'progress' | 'overdue' | 'completed' | 'revenue' | 'danger' | 'success';

const TONE_CHIP_VAR: Record<MetricTone, string> = {
  default: 'var(--color-ink-soft)',
  total: 'var(--color-chip-total)',
  progress: 'var(--color-chip-progress)',
  overdue: 'var(--color-chip-overdue)',
  completed: 'var(--color-chip-completed)',
  revenue: 'var(--color-chip-revenue)',
  danger: 'var(--color-danger)',
  success: 'var(--color-success)',
};

const TONE_VALUE_CLASS: Record<MetricTone, string> = {
  default: 'text-[var(--color-ink)]',
  total: 'text-[var(--color-ink)]',
  progress: 'text-[var(--color-ink)]',
  overdue: 'text-[var(--color-danger)]',
  completed: 'text-[var(--color-ink)]',
  revenue: 'text-[var(--color-ink)]',
  danger: 'text-[var(--color-danger)]',
  success: 'text-[var(--color-success)]',
};

export function MetricCard({
  label,
  value,
  tone = 'default',
  icon,
  trend,
}: {
  label: string;
  value: string;
  tone?: MetricTone;
  icon?: ReactNode;
  trend?: { direction: 'up' | 'down'; label: string };
}) {
  const chipVar = TONE_CHIP_VAR[tone];
  const valueClass = TONE_VALUE_CLASS[tone];

  return (
    <div className="bg-[var(--color-panel)] rounded-xl border surface-card surface-card-interactive border-[var(--color-concrete-light)] px-5 py-4">
      <div className="flex items-start justify-between mb-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-concrete)]">{label}</p>
        {icon && (
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: chipVar, color: '#ffffff' }}
          >
            {icon}
          </span>
        )}
      </div>
      <p className={`font-[var(--font-mono)] text-3xl font-bold leading-none tracking-tight ${valueClass}`}>
        {value}
      </p>
      {trend && (
        <p
          className={`flex items-center gap-1 text-xs mt-2 font-medium ${
            trend.direction === 'up' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}
        >
          {trend.direction === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {trend.label}
        </p>
      )}
    </div>
  );
}
