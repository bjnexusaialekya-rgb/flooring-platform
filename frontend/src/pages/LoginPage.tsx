import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/work-orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center auth-gradient-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-[var(--font-display)] text-2xl font-semibold text-white">
            Trestle<span className="text-[var(--color-amber)]">.</span>
          </div>
          <div className="text-white/50 text-sm mt-1">B2B work order platform</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-7 shadow-2xl space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]
                       text-white font-medium text-sm rounded-md py-2.5 transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
