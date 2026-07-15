import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layers, ArrowLeft } from 'lucide-react';
import { api, ApiRequestError, type WorkOrderPortalView } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StatusPipeline } from '../components/StatusPipeline';
import { EmptyState, TableSkeleton } from '../components/UIState';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';

type StockShortage = {
  materialId: string;
  sku: string;
  name: string;
  onHand: number;
  required: number;
  shortBy: number;
};

type StaffLineItem = {
  id: string;
  room_name: string;
  quantity_calculated: number;
  unit_price_charged: number | null;
  internal_cost_basis: number | null;
};

const NEXT_STATUS: Record<string, string> = {
  pending_review: 'priced',
  priced: 'approved',
  approved: 'scheduled',
  scheduled: 'completed',
  completed: 'billing_approved',
  billing_approved: 'invoiced',
};

function marginInfo(price: number | null, cost: number | null) {
  if (price === null || cost === null || price === 0) return null;
  const pct = ((price - cost) / price) * 100;
  const tone = pct >= 30 ? 'good' : pct >= 15 ? 'warn' : 'bad';
  return { pct, tone };
}

type StaffMember = { id: string; display_name: string };

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-6 bg-[var(--color-concrete-light)] rounded w-56 mb-2" />
        <div className="h-3 bg-[var(--color-concrete-light)] rounded w-36" />
      </div>
      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 mb-6">
        <div className="h-3 bg-[var(--color-concrete-light)] rounded w-full mb-4" />
        <div className="h-8 bg-[var(--color-concrete-light)] rounded w-40" />
      </div>
      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        <TableSkeleton columns={3} rows={4} />
      </div>
    </div>
  );
}

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<WorkOrderPortalView | null>(null);
  const [staffLineItems, setStaffLineItems] = useState<StaffLineItem[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [stockShortages, setStockShortages] = useState<StockShortage[] | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const isStaff = user?.role === 'staff' || user?.role === 'admin';

  useEffect(() => {
    if (!id) return;
    api
      .get<WorkOrderPortalView>(`/work-orders/${id}/portal-view`)
      .then(setOrder)
      .catch((err) => setError(err.message));

    // Staff/admin also need the price-bearing fields, which the
    // portal-view route deliberately never returns. GET
    // /work-orders/:id/staff-view mirrors portal-view but without the
    // column exclusion, guarded by requireRole('staff','admin').
    if (isStaff) {
      setStaffLoading(true);
      api
        .get<{ lineItems: StaffLineItem[]; assigned_to: string | null }>(`/work-orders/${id}/staff-view`)
        .then((res) => {
          setStaffLineItems(res.lineItems);
          setAssignedTo(res.assigned_to ?? '');
          setScheduledDate((res as any).scheduled_date ?? '');
        })
        .catch(() => {
          /* non-fatal: pricing panel just won't populate */
        })
        .finally(() => setStaffLoading(false));
      api.get<StaffMember[]>('/users?role=staff').then(setStaffMembers).catch(() => {});
    }
  }, [id, isStaff]);

  async function saveAssignment(newAssignedTo: string, newScheduledDate?: string) {
    if (!id) return;
    setAssignedTo(newAssignedTo);
    const dateToSend = newScheduledDate !== undefined ? newScheduledDate : scheduledDate;
    try {
      await api.patch(`/work-orders/${id}/assign`, { assignedTo: newAssignedTo || null, scheduledDate: dateToSend || null });
      showSuccess('Assignment updated');
    } catch (err) {
      // Action-level failure: toast, not the page-replacing `error` state
      // (that's reserved for the initial portal-view/staff-view load).
      showError(err instanceof Error ? err.message : 'Failed to assign');
    }
  }

  async function savePrice(lineItemId: string) {
    const value = priceDrafts[lineItemId];
    if (!value || !id) return;
    setSaving(lineItemId);
    try {
      await api.patch(`/work-orders/${id}/line-items/${lineItemId}/price`, {
        unitPriceCharged: Number(value),
      });
      setStaffLineItems((prev) =>
        prev.map((li) => (li.id === lineItemId ? { ...li, unit_price_charged: Number(value) } : li))
      );
      showSuccess('Price saved');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save price');
    } finally {
      setSaving(null);
    }
  }

  async function advanceStatus(forceOverride = false) {
    if (!id || !order) return;
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setAdvancing(true);
    try {
      const updated = await api.patch<{ id: string; status: string }>(`/work-orders/${id}/status`, {
        status: nextStatus,
        ...(forceOverride ? { forceOverride: true } : {}),
      });
      setOrder((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setStockShortages(null);
      showSuccess(`Status advanced to ${updated.status.replace(/_/g, ' ')}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409 && Array.isArray(err.body.shortages)) {
        setStockShortages(err.body.shortages as StockShortage[]);
      } else {
        showError(err instanceof Error ? err.message : 'Failed to advance status');
      }
    } finally {
      setAdvancing(false);
    }
  }

  if (error) {
    return (
      <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3">
        {error}
      </div>
    );
  }

  if (!order) {
    return <DetailSkeleton />;
  }

  return (
    <div>
      <Link
        to="/work-orders"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-concrete)] hover:text-[var(--color-ink)] mb-3"
      >
        <ArrowLeft size={13} />
        Work Orders
      </Link>
      <div className="mb-6">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Work Order {order.po_number ?? `#${order.id.slice(0, 8)}`}
        </h1>
        <p className="text-sm text-[var(--color-concrete)] mt-1">
          Submitted {new Date(order.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 mb-6">
        <StatusPipeline currentStatus={order.status} />
        <div className="flex items-center justify-between mt-2">
          {isStaff && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-concrete)]">Assigned to</label>
              <select
                value={assignedTo}
                onChange={(e) => saveAssignment(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-[var(--color-concrete-light)] bg-white"
              >
                <option value="">Unassigned</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
              <label className="text-xs text-[var(--color-concrete)] ml-3">Install date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => { setScheduledDate(e.target.value); saveAssignment(assignedTo, e.target.value); }}
                className="text-xs px-2 py-1.5 rounded-md border border-[var(--color-concrete-light)] bg-white"
              />
            </div>
          )}
          {isStaff && NEXT_STATUS[order.status] && (
            <Button
              onClick={() => advanceStatus(false)}
              isLoading={advancing}
              className="!text-xs"
            >
              {advancing ? 'Updating…' : `Advance to "${NEXT_STATUS[order.status].replace('_', ' ')}"`}
            </Button>
          )}
        </div>
        {stockShortages && stockShortages.length > 0 && (
          <div className="mt-4 rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4">
            <p className="text-sm font-medium text-[var(--color-danger)] mb-2">
              Completing this work order would drive stock negative:
            </p>
            <ul className="text-xs text-[var(--color-ink)] mb-3 space-y-1">
              {stockShortages.map((s) => (
                <li key={s.materialId}>
                  {s.name} ({s.sku}): on hand {s.onHand}, needs {s.required} — short by {s.shortBy}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => advanceStatus(true)}
                isLoading={advancing}
                className="!text-xs !px-3 !py-1.5"
              >
                {advancing ? 'Updating…' : 'Proceed anyway'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStockShortages(null)}
                className="!text-xs !px-3 !py-1.5 !text-[var(--color-concrete)]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Client-visible section: quantities only, no price ---- */}
      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] px-6 pt-6 mb-4">
          Rooms &amp; Materials
        </h2>

        {order.line_items.length === 0 ? (
          <EmptyState
            icon={<Layers size={22} />}
            title="No rooms recorded"
            description="Room and material quantities will appear here once this work order is scoped."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
                <th className="pb-2 pl-6 font-medium">Room</th>
                <th className="pb-2 font-medium">Quantity (calculated)</th>
                <th className="pb-2 pr-6 font-medium">Quantity (actual)</th>
              </tr>
            </thead>
            <tbody>
              {order.line_items.map((li, i) => (
                <tr key={i} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                  <td className="py-2.5 pl-6 text-[#0a0a0a] font-semibold">{li.roomName}</td>
                  <td className="py-2.5 font-mono text-xs text-[#0a0a0a] font-semibold">{li.quantityCalculated}</td>
                  <td className="py-2.5 pr-6 font-mono text-xs text-[var(--color-concrete)]">
                    {li.quantityActualUsed ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- Staff-only section: literally rendered below the
           boundary line. This is the visual signature — the same cut
           that the SQL SELECT enforces server-side is shown here. ---- */}
      {isStaff && (staffLoading || staffLineItems.length > 0) && (
        <div className="boundary-line">
          <div className="bg-[var(--color-amber-soft)] rounded-xl border border-[var(--color-amber)]/30 overflow-hidden mt-2">
            <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-amber-dark)] px-6 pt-6 mb-4">
              Pricing &amp; Cost Basis
            </h2>

            {staffLoading ? (
              <div className="px-6 pb-6">
                <TableSkeleton columns={4} rows={2} />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-amber-dark)] border-b border-[var(--color-amber)]/30">
                    <th className="pb-2 pl-6 font-medium">Room</th>
                    <th className="pb-2 font-medium">Unit Price Charged</th>
                    <th className="pb-2 font-medium">Internal Cost Basis</th>
                    <th className="pb-2 font-medium">Margin</th>
                    <th className="pb-2 pr-6 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {staffLineItems.map((li) => {
                    const draft = priceDrafts[li.id];
                    const priceForMargin = draft !== undefined ? Number(draft) : li.unit_price_charged;
                    const margin = marginInfo(priceForMargin, li.internal_cost_basis);
                    return (
                      <tr key={li.id} className="border-b last:border-0 border-[var(--color-amber)]/20">
                        <td className="py-2.5 pl-6">{li.room_name}</td>
                        <td className="py-2.5">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={li.unit_price_charged ?? ''}
                            onChange={(e) =>
                              setPriceDrafts((prev) => ({ ...prev, [li.id]: e.target.value }))
                            }
                            className="w-24 px-2 py-1 rounded border border-[var(--color-amber)]/40 font-mono text-xs
                                       focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="py-2.5 font-mono text-xs text-[var(--color-amber-dark)]">
                          {li.internal_cost_basis ?? '—'}
                        </td>
                        <td className="py-2.5">
                          {margin ? (
                            <span
                              className={
                                'font-mono text-xs px-2 py-0.5 rounded-full ' +
                                (margin.tone === 'good'
                                  ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                                  : margin.tone === 'warn'
                                  ? 'bg-[var(--color-amber)]/20 text-[var(--color-amber-dark)]'
                                  : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]')
                              }
                            >
                              {margin.pct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-concrete)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-6">
                          <Button
                            variant="ghost"
                            onClick={() => savePrice(li.id)}
                            isLoading={saving === li.id}
                            className="!text-xs !px-2 !py-1 !text-[var(--color-amber-dark)] !bg-transparent hover:!bg-[var(--color-amber)]/10"
                          >
                            {saving === li.id ? 'Saving…' : 'Save'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
