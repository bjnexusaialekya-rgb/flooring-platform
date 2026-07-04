import { useEffect, useState } from 'react';
import { TrendingUp, AlertCircle, Building2 } from 'lucide-react';
import { api } from '../lib/api';

type ReportSummary = {
  statusCounts: { status: string; count: number }[];
  revenueThisMonth: number;
  topProperties: { name: string; work_order_count: number }[];
  pendingSyncFailures: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Submitted',
  priced: 'Priced',
  approved: 'Approved',
  scheduled: 'Scheduled',
  completed: 'Completed',
  billing_approved: 'Billing',
  invoiced: 'Invoiced',
};

export function ReportsPage() {
  const [data, setData] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ReportSummary>('/reports/summary').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="text-sm text-[var(--color-concrete)]">Loading…</div>;
  }

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Dashboard
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Operational snapshot across all active properties.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-primary)] mb-2">
            <TrendingUp size={16} />
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-concrete)]">
              Revenue this month
            </span>
          </div>
          <div className="font-[var(--font-mono)] text-2xl font-semibold text-[var(--color-ink)]">
            ${data.revenueThisMonth.toFixed(2)}
          </div>
        </div>

        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-amber-dark)] mb-2">
            <AlertCircle size={16} />
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-concrete)]">
              QBO sync failures
            </span>
          </div>
          <div className="font-[var(--font-mono)] text-2xl font-semibold text-[var(--color-ink)]">
            {data.pendingSyncFailures}
          </div>
        </div>

        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-success)] mb-2">
            <Building2 size={16} />
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-concrete)]">
              Active properties
            </span>
          </div>
          <div className="font-[var(--font-mono)] text-2xl font-semibold text-[var(--color-ink)]">
            {data.topProperties.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
          <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">
            Work Orders by Stage
          </h2>
          <div className="space-y-2">
            {data.statusCounts.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-ink-soft)]">{STATUS_LABELS[s.status] ?? s.status}</span>
                <span className="font-mono text-[var(--color-ink)]">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
          <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">
            Top Properties by Volume
          </h2>
          <div className="space-y-2">
            {data.topProperties.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-ink-soft)]">{p.name}</span>
                <span className="font-mono text-[var(--color-ink)]">{p.work_order_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
