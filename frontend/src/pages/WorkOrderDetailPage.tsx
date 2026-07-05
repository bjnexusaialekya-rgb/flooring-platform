import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type WorkOrderPortalView } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StatusPipeline } from '../components/StatusPipeline';

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

type StaffMember = { id: string; display_name: string };

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
      api
        .get<{ lineItems: StaffLineItem[]; assigned_to: string | null }>(`/work-orders/${id}/staff-view`)
        .then((res) => {
          setStaffLineItems(res.lineItems);
          setAssignedTo(res.assigned_to ?? '');
          setScheduledDate((res as any).scheduled_date ?? '');
        })
        .catch(() => {
          /* non-fatal: pricing panel just won't populate */
        });
      api.get<StaffMember[]>('/users?role=staff').then(setStaffMembers).catch(() => {});
    }
  }, [id, isStaff]);

  async function saveAssignment(newAssignedTo: string, newScheduledDate?: string) {
    if (!id) return;
    setAssignedTo(newAssignedTo);
    const dateToSend = newScheduledDate !== undefined ? newScheduledDate : scheduledDate;
    try {
      await api.patch(`/work-orders/${id}/assign`, { assignedTo: newAssignedTo || null, scheduledDate: dateToSend || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save price');
    } finally {
      setSaving(null);
    }
  }

  async function advanceStatus() {
    if (!id || !order) return;
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setAdvancing(true);
    try {
      const updated = await api.patch<{ id: string; status: string }>(`/work-orders/${id}/status`, {
        status: nextStatus,
      });
      setOrder((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance status');
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
    return <div className="text-sm text-[var(--color-concrete)]">Loading…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Work Order {order.po_number ?? `#${order.id.slice(0, 8)}`}
        </h1>
        <p className="text-sm text-[var(--color-concrete)] mt-1">
          Submitted {new Date(order.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 mb-6">
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
            <button
              onClick={advanceStatus}
              disabled={advancing}
              className="bg-[var(--color-ink)] hover:bg-black text-white text-xs font-medium
                         rounded-md px-4 py-2 transition-colors disabled:opacity-60"
            >
              {advancing ? 'Updating…' : `Advance to "${NEXT_STATUS[order.status].replace('_', ' ')}"`}
            </button>
          )}
        </div>
      </div>

      {/* ---- Client-visible section: quantities only, no price ---- */}
      <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
        <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">
          Rooms &amp; Materials
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
              <th className="pb-2 font-medium">Room</th>
              <th className="pb-2 font-medium">Quantity (calculated)</th>
              <th className="pb-2 font-medium">Quantity (actual)</th>
            </tr>
          </thead>
          <tbody>
            {order.line_items.map((li, i) => (
              <tr key={i} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                <td className="py-2.5">{li.roomName}</td>
                <td className="py-2.5 font-mono text-xs">{li.quantityCalculated}</td>
                <td className="py-2.5 font-mono text-xs text-[var(--color-concrete)]">
                  {li.quantityActualUsed ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Staff-only section: literally rendered below the
           boundary line. This is the visual signature — the same cut
           that the SQL SELECT enforces server-side is shown here. ---- */}
      {isStaff && staffLineItems.length > 0 && (
        <div className="boundary-line">
          <div className="bg-[var(--color-amber-soft)] rounded-xl border border-[var(--color-amber)]/30 p-6 mt-2">
            <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-amber-dark)] mb-4">
              Pricing &amp; Cost Basis
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-amber-dark)]/70 border-b border-[var(--color-amber)]/30">
                  <th className="pb-2 font-medium">Room</th>
                  <th className="pb-2 font-medium">Unit Price Charged</th>
                  <th className="pb-2 font-medium">Internal Cost Basis</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {staffLineItems.map((li) => (
                  <tr key={li.id} className="border-b last:border-0 border-[var(--color-amber)]/20">
                    <td className="py-2.5">{li.room_name}</td>
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
                    <td className="py-2.5 font-mono text-xs text-[var(--color-amber-dark)]/70">
                      {li.internal_cost_basis ?? '—'}
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => savePrice(li.id)}
                        disabled={saving === li.id}
                        className="text-xs font-medium text-[var(--color-amber-dark)] hover:underline disabled:opacity-50"
                      >
                        {saving === li.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
