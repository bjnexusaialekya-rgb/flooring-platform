import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

export function AddClientPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      await api.post('/auth/register', {
        displayName,
        email,
        password,
        role: 'client',
        clientId,
      });
      setResult(`Client login created for ${email}.`);
      setDisplayName('');
      setEmail('');
      setPassword('');
      setClientId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client login');
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Add Client
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Create a login for a new property manager.
      </p>
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 space-y-4"
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
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Client ID</label>
          <input required value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm font-mono"
            placeholder="uuid" />
        </div>
        {error && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">{error}</div>}
        {result && <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-md px-3 py-2">{result}</div>}
        <button type="submit" className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium text-sm rounded-md py-2.5 transition-colors">
          Create Client Login
        </button>
      </form>
    </div>
  );
}
