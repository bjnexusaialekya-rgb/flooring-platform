import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { api, type InventoryItem } from '../lib/api';
import { EmptyState, TableSkeleton, MetricCard } from '../components/UIState';

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSkus = items?.length ?? 0;
  const belowReorder = items?.filter((i) => i.needs_reorder).length ?? 0;

  useEffect(() => {
    api.get<InventoryItem[]>('/inventory').then(setItems).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Inventory
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Stock levels across all materials. Items below their reorder threshold are flagged.
      </p>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {items !== null && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <MetricCard label="Total SKUs" value={String(totalSkus)} />
          <MetricCard
            label="Below reorder threshold"
            value={String(belowReorder)}
            tone={belowReorder > 0 ? 'danger' : 'success'}
          />
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        {items === null && <TableSkeleton columns={6} rows={5} />}

        {items !== null && items.length === 0 && (
          <EmptyState
            icon={<Boxes size={22} />}
            title="No materials tracked yet"
            description="Materials will appear here once they're added to your catalog and stocked."
          />
        )}

        {items !== null && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-concrete-light)] text-left text-xs uppercase tracking-wide text-[var(--color-concrete)]">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Material</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">On Hand</th>
                <th className="px-5 py-3 font-medium">Reorder At</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                  <td className="px-5 py-3.5 font-mono text-xs text-[#0a0a0a] font-semibold">{item.sku}</td>
                  <td className="px-5 py-3.5 text-[#0a0a0a] font-semibold">{item.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-plum-soft)] text-[var(--color-plum-dark)]">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#0a0a0a] font-semibold">
                    {item.quantity_on_hand} {item.unit_of_measure}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[var(--color-concrete)]">
                    {Number(item.reorder_threshold) > 0 ? `${item.reorder_threshold} ${item.unit_of_measure}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {item.needs_reorder && (
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
                        Reorder needed
                      </span>
                    )}
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
