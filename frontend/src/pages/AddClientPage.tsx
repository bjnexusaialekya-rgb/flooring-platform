import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/Button';

type ClientOption = { id: string; corporate_name: string };

export function AddClientPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<ClientOption[]>('/admin-setup/clients')
      .then(setClients)
      .catch((err) => console.error('Failed to load companies', err));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      await api.post('/auth/register', {
        displayName,
        email,
        password,
        role: 'client',
        clientId,
      });
      setResult(`Login created for ${email}.`);
      setDisplayName('');
      setEmail('');
      setPassword('');
      setClientId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create login');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Add Login
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Create a login for a property manager at an existing company. To onboard a brand-new
        company first, use Add Company.
      </p>
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Display Name</label>
          <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Temporary Password</label>
          <input required type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Company</label>
          <select required value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm">
            <option value="">Select a company…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.corporate_name}</option>
            ))}
          </select>
        </div>
        {error && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">{error}</div>}
        {result && <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-md px-3 py-2">{result}</div>}
        <Button type="submit" isLoading={submitting} className="w-full">
          Create Login
        </Button>
      </form>
    </div>
  );
}
