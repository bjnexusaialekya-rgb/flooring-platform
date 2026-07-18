import { useEffect, useState, type FormEvent } from 'react';
import { HardHat, Plus } from 'lucide-react';
import { api, type Installer } from '../lib/api';
import { EmptyState, TableSkeleton, MetricCard } from '../components/UIState';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';

const SPECIALTIES = ['LVP', 'Carpet', 'Sheet Vinyl', 'Tile', 'Hardwood', 'General'] as const;

export function InstallersPage() {
  const { showInfo } = useToast();
  const [installers, setInstallers] = useState<Installer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [crewCapacity, setCrewCapacity] = useState('1');

  function load() {
    api.get<Installer[]>('/installers').then(setInstallers).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const activeCount = installers?.filter((i) => i.is_active).length ?? 0;
  const openLoad = installers?.reduce((sum, i) => sum + Number(i.open_work_order_count), 0) ?? 0;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/installers', {
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
        specialty: specialty || undefined,
        crewCapacity: crewCapacity ? Number(crewCapacity) : undefined,
      });
      setName('');
      setPhone('');
      setEmail('');
      setSpecialty('');
      setCrewCapacity('1');
      setFormOpen(false);
      load();
    } catch (err) {
      showInfo(err instanceof Error ? err.message : 'Could not add installer');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await api.patch(`/installers/${id}`, { isActive: false });
      load();
    } catch (err) {
      showInfo(err instanceof Error ? err.message : 'Could not deactivate installer');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Installers
        </h1>
        <Button variant="ghost" className="btn-cta-gradient" style={{ background: "linear-gradient(135deg, var(--color-cta-start), var(--color-cta-end))" }} onClick={() => setFormOpen((v) => !v)}>
          <Plus size={15} />
          {formOpen ? 'Cancel' : 'Add Installer'}
        </Button>
      </div>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Crews and techs assignable to work orders — replaces the old assigned_to/users hack.
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
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Installer / crew name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm"
              placeholder="Mike Anderson"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Specialty</label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm bg-white"
            >
              <option value="">— Unspecified —</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Crew capacity</label>
            <input
              type="number"
              min={1}
              value={crewCapacity}
              onChange={(e) => setCrewCapacity(e.target.value)}
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
            <Button type="submit" isLoading={saving}>Save Installer</Button>
          </div>
        </form>
      )}

      {installers !== null && installers.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <MetricCard label="Active installers" value={String(activeCount)} tone="total" icon={<HardHat size={18} />} />
          <MetricCard label="Open jobs across crews" value={String(openLoad)} tone="secondary" />
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        {installers === null && <TableSkeleton columns={6} rows={5} />}

        {installers !== null && installers.length === 0 && (
          <EmptyState
            icon={<HardHat size={22} />}
            title="No installers yet"
            description="Add an installer to start assigning work orders to a real crew instead of a generic user."
          />
        )}

        {installers !== null && installers.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-concrete-light)] text-left text-xs uppercase tracking-wide text-[var(--color-concrete)]">
                <th className="px-5 py-3 font-medium">Installer</th>
                <th className="px-5 py-3 font-medium">Specialty</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Crew Capacity</th>
                <th className="px-5 py-3 font-medium">Open Work Orders</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {installers.map((i) => (
                <tr key={i.id} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                  <td className="px-5 py-3.5 font-medium text-[#0a0a0a]">
                    {i.name}
                    {!i.is_active && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--color-concrete-light)] text-[var(--color-ink-soft)]">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[var(--color-concrete)]">{i.specialty || '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-[var(--color-concrete)]">
                    {[i.phone, i.email].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#0a0a0a] font-semibold">{i.crew_capacity}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#0a0a0a] font-semibold">{i.open_work_order_count}</td>
                  <td className="px-5 py-3.5 text-right">
                    {i.is_active && (
                      <button
                        onClick={() => handleDeactivate(i.id)}
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
