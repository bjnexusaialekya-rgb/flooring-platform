import { useEffect, useState, type FormEvent } from 'react';
import { Store, Plus } from 'lucide-react';
import { api, type Vendor } from '../lib/api';
import { EmptyState, TableSkeleton, MetricCard } from '../components/UIState';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';

export function VendorsPage() {
  const { showInfo } = useToast();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  function load() {
    api.get<Vendor[]>('/vendors').then(setVendors).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const activeCount = vendors?.filter((v) => v.is_active).length ?? 0;
  const totalSpend = vendors?.reduce((sum, v) => sum + Number(v.total_spend), 0) ?? 0;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/vendors', {
        name: name.trim(),
        contactName: contactName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        accountNumber: accountNumber || undefined,
      });
      setName('');
      setContactName('');
      setPhone('');
      setEmail('');
      setAccountNumber('');
      setFormOpen(false);
      load();
    } catch (err) {
      showInfo(err instanceof Error ? err.message : 'Could not add vendor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await api.patch(`/vendors/${id}`, { isActive: false });
      load();
    } catch (err) {
      showInfo(err instanceof Error ? err.message : 'Could not deactivate vendor');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Vendors
        </h1>
        <Button variant="ghost" className="btn-cta-gradient" style={{ background: "linear-gradient(135deg, var(--color-cta-start), var(--color-cta-end))" }} onClick={() => setFormOpen((v) => !v)}>
          <Plus size={15} />
          {formOpen ? 'Cancel' : 'Add Vendor'}
        </Button>
      </div>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Material suppliers and distributors used on purchase orders.
      </p>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-5 mb-6 grid grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Vendor name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm"
              placeholder="Shaw Flooring Distribution"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Account #</label>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm"
              placeholder="Your account # with this vendor"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Contact name</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" isLoading={saving}>Save Vendor</Button>
          </div>
        </form>
      )}

      {vendors !== null && vendors.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <MetricCard label="Active vendors" value={String(activeCount)} tone="total" icon={<Store size={18} />} />
          <MetricCard label="Total spend" value={`$${totalSpend.toFixed(2)}`} tone="secondary" />
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        {vendors === null && <TableSkeleton columns={6} rows={5} />}

        {vendors !== null && vendors.length === 0 && (
          <EmptyState
            icon={<Store size={22} />}
            title="No vendors yet"
            description="Add a vendor to start linking purchase orders to a real supplier."
          />
        )}

        {vendors !== null && vendors.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-concrete-light)] text-left text-xs uppercase tracking-wide text-[var(--color-concrete)]">
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Account #</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Purchase Orders</th>
                <th className="px-5 py-3 font-medium">Total Spend</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                  <td className="px-5 py-3.5 font-medium text-[#0a0a0a]">
                    {v.name}
                    {!v.is_active && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--color-concrete-light)] text-[var(--color-ink-soft)]">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[var(--color-concrete)]">{v.account_number || '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-[var(--color-concrete)]">
                    {[v.contact_name, v.phone].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#0a0a0a] font-semibold">{v.purchase_order_count}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#0a0a0a] font-bold">${Number(v.total_spend).toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {v.is_active && (
                      <button
                        onClick={() => handleDeactivate(v.id)}
                        className="text-xs text-[var(--color-concrete)] hover:text-[var(--color-danger)]"
                      >
                        Deactivate
                      </button>
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
