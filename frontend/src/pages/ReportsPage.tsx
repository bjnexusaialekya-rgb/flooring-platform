import { useEffect, useState } from 'react';
import { TrendingUp, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, MetricCard } from '../components/UIState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ReportSummary = {
  statusCounts: { status: string; count: number }[];
  revenueThisMonth: number;
  topProperties: { name: string; work_order_count: number }[];
  pendingSyncFailures: number;
};

const CHART_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#22c55e'];


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
          <div key={i} className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] px-5 py-4">
            <div className="h-3 bg-[var(--color-concrete-light)] rounded w-24 mb-3" />
            <div className="h-6 bg-[var(--color-concrete-light)] rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6">
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
            <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6">
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
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.statusCounts.map((s) => ({ name: STATUS_LABELS[s.status] ?? s.status, count: s.count }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-concrete-light)" />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.statusCounts.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6">
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
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.topProperties.map((p) => ({ name: p.name, count: p.work_order_count }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-concrete-light)" />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
