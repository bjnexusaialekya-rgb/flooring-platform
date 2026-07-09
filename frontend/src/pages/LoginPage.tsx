import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Building2, Users, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';

const FEATURE_CHIPS = [
  {
    icon: Building2,
    title: 'Unit turns',
    description: 'Track work from vacate to closeout.',
  },
  {
    icon: Users,
    title: 'Vendor status',
    description: 'See real-time updates across your team.',
  },
  {
    icon: BarChart3,
    title: 'Portfolio reporting',
    description: 'Make decisions with confidence.',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showInfo } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  function handleForgotPassword() {
    // There's no self-serve reset flow yet, so this is a real, working
    // affordance rather than a dead link: it tells the person what to do
    // instead of silently going nowhere.
    showInfo('Password resets are handled by your operations administrator. Reach out to them directly for a reset.');
  }

  return (
    <div className="min-h-screen flex items-stretch auth-showcase">
      <div className="auth-grain" aria-hidden="true" />

      {/* Marketing panel — hidden below lg, this is a showcase surface, */}
      {/* not the primary task, so it yields to the form on small screens. */}
      <div className="hidden lg:flex flex-col justify-between flex-1 px-16 xl:px-24 py-16 relative z-[1] text-white max-w-3xl">
        <div className="font-[var(--font-display)] text-2xl font-bold tracking-tight">
          Trestle<span className="text-[var(--color-amber)]">.</span>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70 mb-4">
            Commercial Flooring Operations
          </div>
          <h1 className="font-[var(--font-display)] text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight max-w-2xl">
            Work orders built for multi-unit property teams.
          </h1>
          <p className="mt-6 text-lg text-white/80 leading-relaxed max-w-xl">
            Trestle gives property managers and flooring contractors one disciplined system
            for scopes, schedules, vendor coordination, approvals, and portfolio-level visibility.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {FEATURE_CHIPS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-white/15 bg-white/[0.06] backdrop-blur-sm px-4 py-3.5"
            >
              <Icon size={18} className="text-[var(--color-amber)] mb-2" strokeWidth={2} />
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-white/65 mt-0.5 leading-snug">{description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 lg:flex-none lg:w-[480px] xl:w-[520px] flex items-center justify-center px-6 py-16 relative z-[1]">
        <div className="w-full max-w-sm auth-card-frame">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="relative z-[1] bg-white rounded-2xl p-8 sm:p-9 space-y-5"
            style={{ boxShadow: 'var(--elevation-3)' }}
          >
            <div className="flex items-start justify-between">
              <div className="font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
                Trestle<span className="text-[var(--color-amber)]">.</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)] bg-[var(--color-primary-soft)] rounded-full px-2.5 py-1">
                <ShieldCheck size={12} strokeWidth={2.5} />
                Secure
              </div>
            </div>

            <div>
              <h2 className="font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)] leading-snug">
                Sign in to your operations workspace
              </h2>
              <p className="text-sm text-[var(--color-concrete)] mt-1.5 leading-relaxed">
                Access work orders, property schedules, contractor updates, and approval queues.
              </p>
            </div>

            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">
                Work email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-concrete)] pointer-events-none"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[var(--color-concrete-light)] text-sm
                             focus:outline-none focus-visible:outline-none"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-[var(--color-ink-soft)]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-concrete)] pointer-events-none"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  aria-invalid={error ? true : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-[var(--color-concrete-light)] text-sm
                             focus:outline-none focus-visible:outline-none"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-concrete)] hover:text-[var(--color-ink)]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" isLoading={loading} className="w-full justify-center py-2.5 text-[15px]">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-concrete-light)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-concrete)]">
                  Enterprise access
                </span>
              </div>
            </div>

            <p className="text-xs text-center text-[var(--color-concrete)] leading-relaxed">
              Enterprise access is provisioned by your organization. Contact your property
              operations administrator if you need an invite.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
