import { useState, useRef, useLayoutEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ClipboardList, Eye, EyeOff, Lock, Mail, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';

export function LoginPage() {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    panelRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { showInfo } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    showInfo('Password resets are handled by your operations administrator. Reach out to them directly for a reset.');
  }

  return (
    <main className="trestle-photo-login bg-white text-[var(--color-ink)]">
      <section className="trestle-photo-login__shell">
        <aside className="trestle-photo-login__hero" aria-hidden="true">
          <img src="/auth-hero.jpg" alt="" className="trestle-photo-login__hero-img" />
          <div className="trestle-photo-login__hero-scrim" />

          <div className="trestle-photo-login__hero-content">
            <div className="trestle-photo-login__hero-logo">
              Trestle<span>.</span>
            </div>
            <div className="trestle-photo-login__hero-eyebrow">Built for flooring pros</div>
            <h1 className="trestle-photo-login__hero-headline">
              Run every job.
              <br />
              Finish with confidence.
            </h1>
            <p className="trestle-photo-login__hero-body">
              Trestle helps flooring contractors and property teams manage work orders, schedules, vendors, and
              installs across every property.
            </p>
          </div>

          <ul className="trestle-photo-login__hero-features">
            <li>
              <span className="trestle-photo-login__hero-feature-icon">
                <ClipboardList size={20} strokeWidth={2.2} />
              </span>
              <span className="trestle-photo-login__hero-feature-text">
                <span className="trestle-photo-login__hero-feature-title">Manage Work Orders</span>
                <span className="trestle-photo-login__hero-feature-desc">Create, assign, and track every flooring job.</span>
              </span>
            </li>
            <li>
              <span className="trestle-photo-login__hero-feature-icon">
                <CalendarClock size={20} strokeWidth={2.2} />
              </span>
              <span className="trestle-photo-login__hero-feature-text">
                <span className="trestle-photo-login__hero-feature-title">Stay on Schedule</span>
                <span className="trestle-photo-login__hero-feature-desc">Real-time updates keep every install on track.</span>
              </span>
            </li>
            <li>
              <span className="trestle-photo-login__hero-feature-icon">
                <TrendingUp size={20} strokeWidth={2.2} />
              </span>
              <span className="trestle-photo-login__hero-feature-text">
                <span className="trestle-photo-login__hero-feature-title">See the Big Picture</span>
                <span className="trestle-photo-login__hero-feature-desc">Portfolio insights that help you plan ahead.</span>
              </span>
            </li>
          </ul>
        </aside>

        <section ref={panelRef} className="trestle-photo-login__form-panel">
          <form onSubmit={handleSubmit} noValidate className="trestle-photo-login__card">
            <div className="mb-8">
              <h2 className="mt-0 font-[var(--font-display)] text-[34px] font-bold leading-tight tracking-[-0.055em] text-[var(--color-ink)] sm:text-[38px]">
                Welcome back
              </h2>
              <p className="mt-2 font-[var(--font-body)] text-[17px] font-medium leading-7 text-[var(--color-ink-soft)]">
                Log in to your Trestle account
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="login-email" className="mb-2.5 block text-[14px] font-bold text-[var(--color-ink)]">
                  Work email
                </label>
                <div className="trestle-photo-login__input-wrap">
                  <Mail size={21} className="text-[var(--color-concrete)]" strokeWidth={2.1} />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    aria-invalid={error ? true : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="trestle-photo-login__input"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-2.5 block text-[14px] font-bold text-[var(--color-ink)]">
                  Password
                </label>
                <div className="trestle-photo-login__input-wrap">
                  <Lock size={21} className="text-[var(--color-concrete)]" strokeWidth={2.1} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    aria-invalid={error ? true : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="trestle-photo-login__input"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="rounded-md text-[var(--color-concrete)] transition hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  >
                    {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-3 text-[15px] font-medium text-[var(--color-ink-soft)]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-[21px] w-[21px] rounded border-[var(--color-concrete-light)] accent-[var(--color-primary)]"
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="rounded-md text-[15px] font-semibold text-[var(--color-primary)] transition hover:text-[var(--color-primary-dark)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-5 rounded-lg bg-[var(--color-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-danger)]">
                {error}
              </div>
            )}

            <Button type="submit" isLoading={loading} className="mt-7 h-[58px] w-full justify-center rounded-lg text-[18px] font-bold shadow-[0_12px_22px_rgba(91,95,199,0.22)]">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>

            <div className="my-7 flex items-center gap-5">
              <div className="h-px flex-1 bg-[var(--color-concrete-light)]" />
              <span className="text-[15px] font-semibold text-[var(--color-ink-soft)]">or</span>
              <div className="h-px flex-1 bg-[var(--color-concrete-light)]" />
            </div>

            <button
              type="button"
              className="flex h-[58px] w-full items-center justify-center gap-3 rounded-lg border border-[var(--color-concrete-light)] bg-white text-[17px] font-bold text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-paper)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full text-[22px] font-bold leading-none text-[#4285F4]">G</span>
              Continue with Google
            </button>

            <p className="mt-9 text-center text-[15px] font-medium leading-6 text-[var(--color-ink-soft)]">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => showInfo('Ask your operations administrator to provision your Trestle account.')}
                className="font-semibold text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              >
                Contact our team
              </button>{' '}
              to get started.
            </p>
          </form>

          <footer className="trestle-photo-login__footer" aria-label="Legal links">
            <a href="/privacy" className="hover:text-[var(--color-primary)] hover:underline">
              Privacy Policy
            </a>
            <span aria-hidden="true">|</span>
            <a href="/terms" className="hover:text-[var(--color-primary)] hover:underline">
              Terms of Service
            </a>
          </footer>
        </section>
      </section>
    </main>
  );
}
