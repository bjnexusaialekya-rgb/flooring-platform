import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, TableSkeleton } from '../components/UIState';

type WorkOrderSummary = {
  id: string;
  status: string;
  po_number: string | null;
  target_turn_date: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-[var(--color-status-submitted-soft)] text-[var(--color-status-submitted)]',
  priced: 'bg-[var(--color-status-priced-soft)] text-[var(--color-status-priced)]',
  approved: 'bg-[var(--color-status-approved-soft)] text-[var(--color-status-approved)]',
  scheduled: 'bg-[var(--color-status-scheduled-soft)] text-[var(--color-status-scheduled)]',
  completed: 'bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]',
  billing_approved: 'bg-[var(--color-status-billing-soft)] text-[var(--color-status-billing)]',
  invoiced: 'bg-[var(--color-status-invoiced-soft)] text-[var(--color-status-invoiced)]',
};

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-[var(--color-concrete-light)] text-[var(--color-ink-soft)]';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function WorkOrdersListPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<WorkOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get<WorkOrderSummary[]>('/work-orders')
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, []);

  const filtered = (orders ?? []).filter((wo) => {
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
    if (search && !(wo.po_number ?? wo.id).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Work Orders
          </h1>
          <p className="text-sm text-[var(--color-concrete)] mt-1">
            {user?.role === 'client'
              ? 'Track the status of work orders you\'ve submitted.'
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

      {orders && orders.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search PO number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm w-56"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm bg-white"
          >
            <option value="all">All statuses</option>
            {Object.keys(STATUS_STYLES).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--color-concrete)]">
            {filtered.length} of {orders.length}
          </span>
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] overflow-hidden">
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

        {filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-concrete-light)] text-left text-xs uppercase tracking-wide text-[var(--color-concrete)]">
                <th className="px-5 py-3 font-medium">PO Number</th>
                <th className="px-5 py-3 font-medium">Target Turn Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((wo) => (
                <tr
                  key={wo.id}
                  className="border-b last:border-0 border-[var(--color-concrete-light)] hover:bg-[var(--color-primary-soft)]/40 cursor-pointer"
                >
                  <td className="px-5 py-3.5 font-mono text-xs">
                    <Link to={`/work-orders/${wo.id}`} className="text-[var(--color-primary)] hover:underline">
                      {wo.po_number ?? wo.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-ink-soft)]">
                    {wo.target_turn_date ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={wo.status} />
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-concrete)]">
                    {new Date(wo.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
