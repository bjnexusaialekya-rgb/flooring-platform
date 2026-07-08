import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, SearchX, ChevronUp, ChevronDown, AlertTriangle, X } from 'lucide-react';
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
  const [orders, setOrders] = useState<WorkOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
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
    if (search && !(wo.po_number ?? wo.id).toLowerCase().includes(search.toLowerCase())) return false;
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
  const overdueCount = orders?.filter(isOverdue).length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Work Orders
          </h1>
          <p className="text-sm text-[var(--color-concrete)] mt-1">
            {user?.role === 'client'
              ? "Track the status of work orders you've submitted."
              : 'Queue of all active work orders across properties.'}
          </p>
        </div>
        {user?.role === 'client' && (
          <Link
            to="/work-orders/new"
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white
                       text-sm font-medium px-4 py-2.5 rounded-md transition-colors"
          >
            + Submit Work Order
          </Link>
        )}
      </div>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {orders !== null && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard label="Total work orders" value={String(totalCount)} />
          <MetricCard label="Open" value={String(openCount)} />
          <MetricCard
            label="Overdue"
            value={String(overdueCount)}
            tone={overdueCount > 0 ? 'danger' : 'success'}
          />
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search PO number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm w-56
                       focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip label="All statuses" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            {Object.keys(STATUS_LABELS).map((s) => (
              <FilterChip
                key={s}
                label={STATUS_LABELS[s]}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--color-concrete)] ml-auto">
            {filtered.length} of {orders.length}
          </span>
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
                <th className="px-5 py-3 group">
                  <SortHeader label="Target Turn Date" sortKeyValue="target_turn_date" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="px-5 py-3 font-medium">Status</th>
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
