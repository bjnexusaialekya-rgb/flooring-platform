import { useEffect, useState } from 'react';
import { TrendingUp, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, MetricCard } from '../components/UIState';

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

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] px-5 py-4">
            <div className="h-3 bg-[var(--color-concrete-light)] rounded w-24 mb-3" />
            <div className="h-6 bg-[var(--color-concrete-light)] rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
            <div className="h-4 bg-[var(--color-concrete-light)] rounded w-40 mb-4" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between mb-2">
                <div className="h-3 bg-[var(--color-concrete-light)] rounded w-28" />
                <div className="h-3 bg-[var(--color-concrete-light)] rounded w-8" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

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

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Dashboard
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Operational snapshot across all active properties.
      </p>

      {data === null && <DashboardSkeleton />}

      {data !== null && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Revenue this month" value={`$${data.revenueThisMonth.toFixed(2)}`} />
            <MetricCard
              label="QBO sync failures"
              value={String(data.pendingSyncFailures)}
              tone={data.pendingSyncFailures > 0 ? 'danger' : 'success'}
            />
            <MetricCard label="Active properties" value={String(data.topProperties.length)} tone="success" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
              <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">
                Work Orders by Stage
              </h2>
              {data.statusCounts.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp size={22} />}
                  title="No work orders yet"
                  description="Stage breakdown will appear once work orders start moving through the pipeline."
                />
              ) : (
                <div className="space-y-2">
                  {data.statusCounts.map((s) => (
                    <div key={s.status} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-ink-soft)]">{STATUS_LABELS[s.status] ?? s.status}</span>
                      <span className="font-mono text-[var(--color-ink)]">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
              <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">
                Top Properties by Volume
              </h2>
              {data.topProperties.length === 0 ? (
                <EmptyState
                  icon={<Building2 size={22} />}
                  title="No properties yet"
                  description="Property volume rankings will show up here once work orders come in."
                />
              ) : (
                <div className="space-y-2">
                  {data.topProperties.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-ink-soft)]">{p.name}</span>
                      <span className="font-mono text-[var(--color-ink)]">{p.work_order_count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
