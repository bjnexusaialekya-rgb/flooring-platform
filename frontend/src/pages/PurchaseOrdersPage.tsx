import { useEffect, useState } from 'react';
import { Package, FileSearch } from 'lucide-react';
import { api, ApiRequestError, type PurchaseOrderListItem, type PurchaseOrderDetail, type InventoryItem } from '../lib/api';
import { EmptyState, TableSkeleton, MetricCard } from '../components/UIState';
import { KebabMenu } from '../components/KebabMenu';
import { FilterChip } from '../components/FilterChip';
import { Button } from '../components/Button';

const VALID_NEXT: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-[var(--color-concrete-light)] text-[var(--color-concrete)]',
  submitted: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  received: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  cancelled: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[status] ?? STATUS_BADGE.draft}`}>
      {status}
    </span>
  );
}

export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderListItem[] | null>(null);
  const [materials, setMaterials] = useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<PurchaseOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const [draftMaterialId, setDraftMaterialId] = useState('');
  const [draftQuantity, setDraftQuantity] = useState('');
  const [draftUnitCost, setDraftUnitCost] = useState('');
  const [draftLines, setDraftLines] = useState<{ materialId: string; sku: string; name: string; quantity: number; unitCost: number }[]>([]);

  function loadOrders() {
    api.get<PurchaseOrderListItem[]>('/purchase-orders').then(setOrders).catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadOrders();
    api.get<InventoryItem[]>('/inventory').then(setMaterials).catch(() => {});
  }, []);

  function openDetail(id: string) {
    setError(null);
    api.get<PurchaseOrderDetail>(`/purchase-orders/${id}`).then(setSelected).catch((err) => setError(err.message));
  }

  function addDraftLine() {
    if (!draftMaterialId || !draftQuantity || !draftUnitCost) return;
    const mat = materials.find((m) => m.id === draftMaterialId);
    if (!mat) return;
    setDraftLines((prev) => [
      ...prev,
      { materialId: draftMaterialId, sku: mat.sku, name: mat.name, quantity: Number(draftQuantity), unitCost: Number(draftUnitCost) },
    ]);
    setDraftMaterialId('');
    setDraftQuantity('');
    setDraftUnitCost('');
  }

  async function submitNewPO() {
    if (draftLines.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      await api.post('/purchase-orders', {
        lineItems: draftLines.map((l) => ({ materialId: l.materialId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      setDraftLines([]);
      loadOrders();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to create purchase order');
    } finally {
      setCreating(false);
    }
  }

  async function transition(id: string, status: string) {
    setTransitioning(true);
    setError(null);
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status });
      loadOrders();
      openDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setTransitioning(false);
    }
  }

  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'received' | 'cancelled'>('all');
  const openOrders = orders?.filter((o) => o.status === 'draft' || o.status === 'submitted') ?? [];
  const openValue = openOrders.reduce((sum, o) => sum + Number(o.total_cost), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Purchase Orders</h1>
        <p className="text-sm text-[var(--color-concrete)] mt-1">Create purchase orders and receive stock into inventory.</p>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {orders !== null && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard label="Total Purchase Orders" value={String(orders.length)} />
          <MetricCard label="Open Orders" value={String(openOrders.length)} />
          <MetricCard label="Open Order Value" value={`$${openValue.toFixed(2)}`} />
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 mb-6">
        <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">New Purchase Order</h2>
        <div className="flex gap-2 items-end mb-4">
          <div>
            <label className="text-xs text-[var(--color-concrete)] block mb-1">Material</label>
            <select
              value={draftMaterialId}
              onChange={(e) => setDraftMaterialId(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md border border-[var(--color-concrete-light)] bg-white min-w-[200px]"
            >
              <option value="">Select…</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.sku} — {m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--color-concrete)] block mb-1">Quantity</label>
            <input
              type="number"
              value={draftQuantity}
              onChange={(e) => setDraftQuantity(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md border border-[var(--color-concrete-light)] bg-white w-24 font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-concrete)] block mb-1">Unit Cost</label>
            <input
              type="number"
              step="0.01"
              value={draftUnitCost}
              onChange={(e) => setDraftUnitCost(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md border border-[var(--color-concrete-light)] bg-white w-24 font-mono"
            />
          </div>
          <Button
            variant="secondary"
            onClick={addDraftLine}
            className="!text-xs !px-3 !py-1.5"
          >
            Add line
          </Button>
        </div>

        {draftLines.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
                <th className="pb-2 font-medium">Material</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 font-medium">Unit Cost</th>
                <th className="pb-2 font-medium">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {draftLines.map((l, i) => (
                <tr key={i} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                  <td className="py-2">{l.name} ({l.sku})</td>
                  <td className="py-2 font-mono text-xs">{l.quantity}</td>
                  <td className="py-2 font-mono text-xs">${l.unitCost.toFixed(2)}</td>
                  <td className="py-2 font-mono text-xs">${(l.quantity * l.unitCost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Button
          onClick={submitNewPO}
          disabled={draftLines.length === 0}
          isLoading={creating}
          className="!text-xs !px-4 !py-2"
        >
          {creating ? 'Creating…' : 'Create Purchase Order'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
          <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] px-6 pt-6 mb-4">All Purchase Orders</h2>

          <div className="flex gap-2 px-6 mb-4">
            <FilterChip label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <FilterChip label="Draft" active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')} />
            <FilterChip label="Submitted" active={statusFilter === 'submitted'} onClick={() => setStatusFilter('submitted')} />
            <FilterChip label="Received" active={statusFilter === 'received'} onClick={() => setStatusFilter('received')} />
          </div>

          {orders === null && <TableSkeleton columns={4} rows={4} />}

          {orders !== null && orders.length === 0 && (
            <EmptyState
              icon={<Package size={22} />}
              title="No purchase orders yet"
              description="Create your first purchase order above to start receiving stock into inventory."
            />
          )}

          {orders !== null && orders.length > 0 && (
            <table className="w-full text-sm px-6">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
                  <th className="pb-2 pl-6 font-medium">Status</th>
                  <th className="pb-2 font-medium">Lines</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 pr-6 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter((po) => statusFilter === 'all' || po.status === statusFilter)
                  .map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => openDetail(po.id)}
                    className="group border-b last:border-0 border-[var(--color-concrete-light)] cursor-pointer hover:bg-[var(--color-concrete-light)]/20"
                  >
                    <td className="py-4 pl-6"><StatusBadge status={po.status} /></td>
                    <td className="py-4 font-mono text-xs text-[#0a0a0a] font-semibold">{po.line_item_count}</td>
                    <td className="py-4 font-mono text-xs text-[#0a0a0a] font-bold">${Number(po.total_cost).toFixed(2)}</td>
                    <td className="py-4 text-xs text-[#0a0a0a] font-semibold">{new Date(po.created_at).toLocaleDateString()}</td>
                    <td className="py-4 pr-6 text-right">
                      <KebabMenu actions={[
                        { label: 'View detail', onClick: () => openDetail(po.id) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6">
          <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-4">Detail</h2>
          {!selected && (
            <EmptyState
              icon={<FileSearch size={22} />}
              title="Nothing selected"
              description="Select a purchase order from the list to view its line items and status."
            />
          )}
          {selected && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">Status:</span>
                <StatusBadge status={selected.status} />
              </div>
              <p className="text-xs text-[var(--color-concrete)] mb-4">Created by {selected.created_by_name ?? '—'}</p>
              <table className="w-full text-sm mb-4">
                <tbody>
                  {selected.lineItems.map((li) => (
                    <tr key={li.id} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                      <td className="py-2">{li.name} ({li.sku})</td>
                      <td className="py-2 font-mono text-xs">{li.quantity}</td>
                      <td className="py-2 font-mono text-xs">${Number(li.unit_cost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-2">
                {VALID_NEXT[selected.status]?.map((next) =>
                  next === 'cancelled' ? (
                    <Button
                      key={next}
                      variant="ghost"
                      onClick={() => transition(selected.id, next)}
                      isLoading={transitioning}
                      className="!text-xs !px-3 !py-1.5 !text-[var(--color-danger)] !border !border-[var(--color-danger)] !bg-transparent hover:!bg-[var(--color-danger-soft)]"
                    >
                      {transitioning ? 'Updating…' : `Mark as ${next}`}
                    </Button>
                  ) : (
                    <Button
                      key={next}
                      onClick={() => transition(selected.id, next)}
                      isLoading={transitioning}
                      className="!text-xs !px-3 !py-1.5"
                    >
                      {transitioning ? 'Updating…' : `Mark as ${next}`}
                    </Button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
