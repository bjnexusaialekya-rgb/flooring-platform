import { useEffect, useState } from 'react';
import { TrendingUp, Building2, DollarSign, AlertOctagon, RefreshCw, Landmark } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, MetricCard } from '../components/UIState';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { STATUS_LABELS, statusHex } from '../lib/statusColors';

type ReportSummary = {
  statusCounts: { status: string; count: number }[];
  revenueThisMonth: number;
  revenueLastMonth: number;
  overdueCount: number;
  revenueTrend: { day: string; total: number }[];
  topProperties: { name: string; work_order_count: number }[];
  pendingSyncFailures: number;
};

type ArAging = {
  buckets: { bucket_0_30: number; bucket_31_60: number; bucket_60_plus: number };
  totalOutstanding: number;
  batches: { id: string; propertyName: string; amount: number; daysOutstanding: number }[];
};

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
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

// Themed tooltip: inherits the app's fonts/colors instead of Recharts defaults.
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-concrete-light)] rounded-md shadow-lg px-3 py-2">
      <p className="text-xs text-[var(--color-concrete)] uppercase tracking-wide mb-0.5">
        {payload[0].payload.name ?? payload[0].payload.day}
      </p>
      <p className="font-[var(--font-mono)] text-sm font-semibold text-[var(--color-ink)]">
        {payload[0].value}
      </p>
    </div>
  );
}

// Rotating gradient palette for the "Top Properties" bars — single-family
// lime/green gradient set matching the app's cream/lime/green theme,
// replacing the previous arbitrary 5-hue rainbow (blue/pink/purple/orange)
// that clashed with the rest of the product. A 6th+ property wraps back
// to the first gradient.
const PROPERTY_BAR_GRADIENTS = [
  { id: 'propBarLime', from: '#d4e896', to: '#8fae2e' },
  { id: 'propBarForest', from: '#9fc98a', to: '#3a7d3e' },
  { id: 'propBarOlive', from: '#e0d191', to: '#a68a2c' },
  { id: 'propBarSage', from: '#bcd3a8', to: '#5c8a4f' },
  { id: 'propBarMoss', from: '#c8dba0', to: '#6b8f3a' },
];

function pctDelta(current: number, previous: number): { direction: 'up' | 'down'; label: string } | undefined {
  if (previous === 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  return {
    direction: pct >= 0 ? 'up' : 'down',
    label: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% from last month`,
  };
}

// AR aging bucket bar — a single horizontal segment sized by proportion of
// total outstanding, colored by risk (green = current, amber = 31-60,
// red = 60+). Kept as a plain div, not a chart-library component, since
// it's one simple proportional bar rather than anything needing axes.
function AgingBar({ label, amount, total, tone }: { label: string; amount: number; total: number; tone: 'good' | 'warn' | 'bad' }) {
  const pct = total > 0 ? Math.max((amount / total) * 100, amount > 0 ? 3 : 0) : 0;
  const barColor =
    tone === 'good' ? 'bg-[var(--color-success)]' : tone === 'warn' ? 'bg-[var(--color-amber)]' : 'bg-[var(--color-danger)]';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-ink-soft)]">{label}</span>
        <span className="font-mono font-semibold text-[var(--color-ink)]">
          ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-concrete-light)] overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [data, setData] = useState<ReportSummary | null>(null);
  const [arAging, setArAging] = useState<ArAging | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ReportSummary>('/reports/summary').then(setData).catch((err) => setError(err.message));
    api.get<ArAging>('/reports/ar-aging').then(setArAging).catch(() => {
      /* non-fatal: dashboard still renders without the aging widget */
    });
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
          <div className="grid grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Revenue this month"
              value={`$${data.revenueThisMonth.toFixed(2)}`}
              tone="revenue"
              gradient="linear-gradient(135deg, #c2a83e, #935a2e)"
              icon={<DollarSign size={18} />}
              trend={pctDelta(data.revenueThisMonth, data.revenueLastMonth)}
            />
            <MetricCard
              label="Overdue work orders"
              value={String(data.overdueCount)}
              tone={data.overdueCount > 0 ? 'overdue' : 'completed'}
              gradient="linear-gradient(135deg, #D97757, #A34F37)"
              icon={<AlertOctagon size={18} />}
            />
            <MetricCard
              label="QBO sync failures"
              value={String(data.pendingSyncFailures)}
              tone={data.pendingSyncFailures > 0 ? 'danger' : 'success'}
              gradient="linear-gradient(135deg, #F0932B, #B85C1F)"
              icon={<RefreshCw size={18} />}
            />
            <MetricCard
              label="Active properties"
              value={String(data.topProperties.length)}
              tone="total"
              gradient="linear-gradient(135deg, #5CB82E, #2E7D1F)"
              icon={<Building2 size={18} />}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6">
              <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">
                Work Orders by Status
              </h2>
              {data.statusCounts.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp size={22} />}
                  title="No work orders yet"
                  description="Status breakdown will appear once work orders start moving through the pipeline."
                />
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="55%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.statusCounts.map((s) => ({ name: STATUS_LABELS[s.status] ?? s.status, value: s.count, status: s.status }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {data.statusCounts.map((s, i) => (
                          <Cell key={i} fill={statusHex(s.status)} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {data.statusCounts.map((s) => {
                      const total = data.statusCounts.reduce((sum, x) => sum + x.count, 0);
                      const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                      return (
                        <div key={s.status} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusHex(s.status) }} />
                          <span className="text-[var(--color-ink-soft)] truncate">{STATUS_LABELS[s.status] ?? s.status}</span>
                          <span className="ml-auto font-[var(--font-mono)] text-[var(--color-concrete)]">
                            {s.count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)]">
                  Revenue Overview
                </h2>
                <span className="text-xs text-[var(--color-concrete)]">Last 30 days</span>
              </div>
              <p className="font-[var(--font-mono)] text-2xl font-bold text-[var(--color-ink)] mb-4">
                ${data.revenueThisMonth.toFixed(2)}
              </p>
              {data.revenueTrend.every((r) => r.total === 0) ? (
                <EmptyState
                  icon={<DollarSign size={22} />}
                  title="No billed revenue yet"
                  description="The trend line will fill in once work orders reach billing_approved or invoiced."
                />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.revenueTrend} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-concrete-light)" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      interval={6}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="total" stroke="var(--color-chip-revenue)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
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
                <ResponsiveContainer width="100%" height={220} minHeight={220}>
                  <BarChart
                    data={data.topProperties.map((p) => ({ name: p.name, count: p.work_order_count }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                  >
                    <defs>
                      {PROPERTY_BAR_GRADIENTS.map((g) => (
                        <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={g.from} />
                          <stop offset="100%" stopColor={g.to} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-concrete-light)" />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--color-ink)' }}
                      width={110}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-paper)' }} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                      {data.topProperties.map((_, i) => (
                        <Cell
                          key={i}
                          fill={`url(#${PROPERTY_BAR_GRADIENTS[i % PROPERTY_BAR_GRADIENTS.length].id})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* AR aging — outstanding billing batches bucketed by days since
                billing_period_end. Shows even at zero (all-current is good
                news worth confirming, not just hiding the widget). */}
            <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] flex items-center gap-2">
                  <Landmark size={16} className="text-[var(--color-concrete)]" />
                  AR Aging
                </h2>
              </div>
              {arAging === null ? (
                <div className="animate-pulse space-y-3 mt-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-1.5 bg-[var(--color-concrete-light)] rounded-full" />
                  ))}
                </div>
              ) : arAging.totalOutstanding === 0 ? (
                <EmptyState
                  icon={<Landmark size={22} />}
                  title="Nothing outstanding"
                  description="Every billing batch is current — no unpaid balances."
                />
              ) : (
                <>
                  <p className="font-[var(--font-mono)] text-2xl font-bold text-[var(--color-ink)] mb-4">
                    ${arAging.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="space-y-3">
                    <AgingBar label="0–30 days" amount={arAging.buckets.bucket_0_30} total={arAging.totalOutstanding} tone="good" />
                    <AgingBar label="31–60 days" amount={arAging.buckets.bucket_31_60} total={arAging.totalOutstanding} tone="warn" />
                    <AgingBar label="60+ days" amount={arAging.buckets.bucket_60_plus} total={arAging.totalOutstanding} tone="bad" />
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
