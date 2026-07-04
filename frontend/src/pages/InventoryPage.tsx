import { useEffect, useState } from 'react';
import { api, type InventoryItem } from '../lib/api';

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      {items && (
        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] overflow-hidden">
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
                  <td className="px-5 py-3.5 font-mono text-xs">{item.sku}</td>
                  <td className="px-5 py-3.5">{item.name}</td>
                  <td className="px-5 py-3.5 text-[var(--color-concrete)]">{item.category}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">
                    {item.quantity_on_hand} {item.unit_of_measure}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[var(--color-concrete)]">
                    {item.reorder_threshold} {item.unit_of_measure}
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
        </div>
      )}
    </div>
  );
}
