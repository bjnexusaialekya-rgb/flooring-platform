import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ClipboardList, SearchX, ChevronUp, ChevronDown, AlertTriangle, X, Clock, CheckCircle2, Download } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, TableSkeleton, MetricCard } from '../components/UIState';
import { KebabMenu } from '../components/KebabMenu';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterChip } from '../components/FilterChip';
import { Button } from '../components/Button';
import { STATUS_LABELS, statusPillClass } from '../lib/statusColors';

type WorkOrderSummary = {
  id: string;
  status: string;
  po_number: string | null;
  target_turn_date: string | null;
  created_at: string;
  // Below are the new join columns from the backend's search-enabling
  // update. customer_name and total_value are ONLY ever present for
  // staff/admin — the client-role query never selects them, so there's
  // no pricing-blind risk here even though the type allows them.
  property_name?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  customer_name?: string | null;
  installer_name?: string | null;
  total_value?: number | string | null;
};

type SortKey = 'po_number' | 'target_turn_date' | 'created_at';

// Mirrors the transition map used on the detail page's "Advance" button,
// so bulk-advancing here follows the exact same allowed workflow.
const NEXT_STATUS: Record<string, string> = {
  pending_review: 'priced',
  priced: 'approved',
  approved: 'scheduled',
  scheduled: 'completed',
  completed: 'billing_approved',
  billing_approved: 'invoiced',
};

const CLOSED_STATUSES = ['completed', 'billing_approved', 'invoiced'];

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusPillClass(status)}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SortHeader({
  label,
  sortKeyValue,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKeyValue: SortKey;
  currentKey: SortKey;
  currentDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const active = currentKey === sortKeyValue;
  return (
    <button
      onClick={() => onSort(sortKeyValue)}
      className={`flex items-center gap-1 font-medium ${active ? 'text-[var(--color-ink)]' : ''}`}
    >
      {label}
      {active ? (
        currentDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      ) : (
        <ChevronDown size={12} className="opacity-0 group-hover:opacity-30" />
      )}
    </button>
  );
}

function isOverdue(wo: WorkOrderSummary) {
  if (!wo.target_turn_date || CLOSED_STATUSES.includes(wo.status)) return false;
  return new Date(wo.target_turn_date) < new Date();
}

export function WorkOrdersListPage() {
  const { user } = useAuth();
  const { searchQuery } = useOutletContext<{ searchQuery: string }>();
  const [orders, setOrders] = useState<WorkOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';

  function loadOrders() {
    api
      .get<WorkOrderSummary[]>('/work-orders')
      .then(setOrders)
      .catch((err) => setError(err.message));
  }

  useEffect(loadOrders, []);

  const filtered = (orders ?? []).filter((wo) => {
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        wo.po_number ?? wo.id,
        wo.customer_name,
        wo.property_name,
        wo.street_address,
        wo.city,
        wo.installer_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: string = '';
    let bv: string = '';
    if (sortKey === 'po_number') {
      av = a.po_number ?? a.id;
      bv = b.po_number ?? b.id;
    } else if (sortKey === 'target_turn_date') {
      av = a.target_turn_date ?? '';
      bv = b.target_turn_date ?? '';
    } else {
      av = a.created_at;
      bv = b.created_at;
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleSelectAll() {
    if (selected.size === sorted.length && sorted.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((wo) => wo.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAdvance() {
    setBulkUpdating(true);
    setError(null);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const wo = orders?.find((o) => o.id === id);
        if (!wo) return;
        const next = NEXT_STATUS[wo.status];
        if (!next) return;
        await api.patch(`/work-orders/${id}/status`, { status: next });
      })
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      setError(
        `${failed} of ${ids.length} work order(s) couldn't be advanced — they may need stock, or are already at their final stage.`
      );
    }
    setSelected(new Set());
    setBulkUpdating(false);
    loadOrders();
  }

  const totalCount = orders?.length ?? 0;
  const openCount = orders?.filter((o) => !CLOSED_STATUSES.includes(o.status)).length ?? 0;
  const completedCount = orders?.filter((o) => CLOSED_STATUSES.includes(o.status)).length ?? 0;
  const overdueCount = orders?.filter(isOverdue).length ?? 0;

  // Per-status counts for the filter tabs (live counts, mirrors what the
  // mock shows). Built off the full `orders` array, not `filtered`, so
  // switching tabs doesn't make the other tabs' counts shift under you.
  const statusCounts: Record<string, number> = {};
  for (const s of Object.keys(STATUS_LABELS)) {
    statusCounts[s] = orders?.filter((o) => o.status === s).length ?? 0;
  }

  // Export is built from `filtered` (whatever's currently on screen, not
  // the full unfiltered set) and only reads fields already present on the
  // WorkOrderSummary objects this role's API response gave us — so a
  // client's export can't contain columns a client was never sent in the
  // first place. No separate permission check needed here for that reason.
  function exportCsv() {
    const cols: { key: keyof WorkOrderSummary; label: string }[] = isStaffOrAdmin
      ? [
          { key: 'po_number', label: 'PO Number' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'property_name', label: 'Project' },
          { key: 'installer_name', label: 'Installer' },
          { key: 'status', label: 'Status' },
          { key: 'target_turn_date', label: 'Target Turn Date' },
          { key: 'total_value', label: 'Value' },
          { key: 'created_at', label: 'Submitted' },
        ]
      : [
          { key: 'po_number', label: 'PO Number' },
          { key: 'property_name', label: 'Project' },
          { key: 'status', label: 'Status' },
          { key: 'target_turn_date', label: 'Target Turn Date' },
          { key: 'created_at', label: 'Submitted' },
        ];

    const escapeCell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = [
      cols.map((c) => c.label).join(','),
      ...filtered.map((wo) => cols.map((c) => escapeCell(wo[c.key])).join(',')),
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Title lives in the topbar now (AppShell). For staff/admin the
          topbar also carries the "New Work Order" CTA, so nothing extra
          renders here for them. Clients keep their own subtitle + button
          since the topbar CTA is staff/admin-only (see getTopbarConfig). */}
      {user?.role === 'client' && (
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[var(--color-concrete)]">
            Track the status of work orders you've submitted.
          </p>
          <Link
            to="/work-orders/new"
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white
                       text-sm font-medium px-4 py-2.5 rounded-md transition-colors"
          >
            + Submit Work Order
          </Link>
        </div>
      )}

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {orders !== null && orders.length > 0 && (
        // 4 cards, not the mock's 5 — deliberately no "Total Revenue" card
        // here. That number already lives on the Dashboard (reportRoutes.js
        // revenueThisMonth), and this page has no other unique revenue
        // scope to show that wouldn't just be the same figure restated.
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard label="Total work orders" value={String(totalCount)} tone="total" icon={<ClipboardList size={18} />} />
          <MetricCard label="In progress" value={String(openCount)} tone="progress" icon={<Clock size={18} />} />
          <MetricCard label="Completed" value={String(completedCount)} tone="completed" icon={<CheckCircle2 size={18} />} />
          <MetricCard
            label="Overdue"
            value={String(overdueCount)}
            tone={overdueCount > 0 ? 'overdue' : 'completed'}
            icon={overdueCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          />
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip label={`All statuses (${totalCount})`} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            {Object.keys(STATUS_LABELS).map((s) => (
              <FilterChip
                key={s}
                label={`${STATUS_LABELS[s]} (${statusCounts[s]})`}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--color-concrete)] ml-auto shrink-0">
            {filtered.length} of {orders.length}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--color-concrete-light)] text-[var(--color-ink)] hover:bg-[var(--color-paper)] shrink-0"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      )}

      {isStaffOrAdmin && selected.size > 0 && (
        <div className="flex items-center justify-between bg-[var(--color-primary-soft)] border border-[var(--color-primary)]/20 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-sm font-medium text-[var(--color-primary)]">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setConfirmOpen(true)}
              isLoading={bulkUpdating}
              className="!text-xs !px-3 !py-1.5"
            >
              {bulkUpdating ? 'Updating…' : 'Advance to next stage'}
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-[var(--color-primary)] hover:opacity-70"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        {orders === null && <TableSkeleton columns={4} rows={5} />}

        {orders !== null && orders.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="No work orders yet"
            description={
              user?.role === 'client'
                ? 'Submit your first work order to get started.'
                : 'Work orders will appear here once a property manager submits one.'
            }
          />
        )}

        {orders !== null && orders.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={<SearchX size={22} />}
            title="No work orders match this filter"
            description="Try a different search term or status filter."
          />
        )}

        {sorted.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-concrete-light)] text-left text-xs uppercase tracking-wide text-[var(--color-concrete)]">
                {isStaffOrAdmin && (
                  <th className="pl-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === sorted.length && sorted.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-[var(--color-concrete-light)]"
                    />
                  </th>
                )}
                <th className="px-5 py-3 group">
                  <SortHeader label="PO Number" sortKeyValue="po_number" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </th>
                {isStaffOrAdmin && <th className="px-5 py-3 font-medium">Customer</th>}
                <th className="px-5 py-3 font-medium">Project</th>
                {isStaffOrAdmin && <th className="px-5 py-3 font-medium">Installer</th>}
                <th className="px-5 py-3 group">
                  <SortHeader label="Target Turn Date" sortKeyValue="target_turn_date" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="px-5 py-3 font-medium">Status</th>
                {isStaffOrAdmin && <th className="px-5 py-3 font-medium text-right">Value</th>}
                <th className="px-5 py-3 group">
                  <SortHeader label="Submitted" sortKeyValue="created_at" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((wo) => {
                const overdue = isOverdue(wo);
                return (
                  <tr
                    key={wo.id}
                    className="group border-b last:border-0 border-[var(--color-concrete-light)] hover:bg-[var(--color-primary-soft)]/40"
                  >
                    {isStaffOrAdmin && (
                      <td className="pl-5 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(wo.id)}
                          onChange={() => toggleSelectOne(wo.id)}
                          className="rounded border-[var(--color-concrete-light)]"
                        />
                      </td>
                    )}
                    <td className="px-5 py-4 font-mono text-xs">
                      <Link
                        to={`/work-orders/${wo.id}`}
                        className="inline-flex items-center px-2 py-1 rounded-md border border-[var(--color-concrete-light)] bg-[var(--color-paper)] text-[var(--color-ink)] font-medium transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                      >
                        {wo.po_number ?? wo.id.slice(0, 8)}
                      </Link>
                    </td>
                    {isStaffOrAdmin && (
                      <td className="px-5 py-4 text-[var(--color-ink)]">{wo.customer_name ?? '—'}</td>
                    )}
                    <td className="px-5 py-4 text-[var(--color-ink-soft)]">
                      {wo.property_name ?? '—'}
                      {wo.street_address && (
                        <div className="text-xs text-[var(--color-concrete)]">{wo.street_address}</div>
                      )}
                    </td>
                    {isStaffOrAdmin && (
                      <td className="px-5 py-4 text-[var(--color-ink-soft)]">{wo.installer_name ?? '—'}</td>
                    )}
                    <td className="px-5 py-4">
                      {wo.target_turn_date && !isNaN(new Date(wo.target_turn_date).getTime()) ? (
                        <span className={`flex items-center gap-1.5 ${overdue ? 'text-[var(--color-danger)] font-medium' : 'text-[var(--color-ink-soft)]'}`}>
                          {overdue && <AlertTriangle size={13} />}
                          {new Date(wo.target_turn_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                        </span>
                      ) : (
                        <span className="text-[var(--color-ink-soft)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={wo.status} />
                    </td>
                    {isStaffOrAdmin && (
                      // Amber, deliberately — this is the one spot on this
                      // page that touches price data, so it uses the same
                      // pricing-blind-boundary color reserved for that
                      // purpose elsewhere in the app (WorkOrderDetailPage's
                      // staff-only cost table, see AppShell.tsx's comment).
                      <td className="px-5 py-4 text-right font-mono text-[var(--color-amber)] font-medium">
                        {wo.total_value != null
                          ? `$${Number(wo.total_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                    )}
                    <td className="px-5 py-4 text-[var(--color-concrete)]">
                      {new Date(wo.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <KebabMenu actions={[
                        { label: 'View detail', onClick: () => window.location.assign(`/work-orders/${wo.id}`) },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Advance selected work orders?"
        message={`This will move ${selected.size} work order${selected.size === 1 ? '' : 's'} to the next stage. This cannot be undone automatically.`}
        confirmText="Advance"
        isLoading={bulkUpdating}
        onConfirm={() => { setConfirmOpen(false); bulkAdvance(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
