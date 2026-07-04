import { useEffect, useState, type FormEvent } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../lib/api';

type SyncFailure = { id: string; billing_batch_id: string; error_message: string; failed_at: string };

// Publishable key is safe to expose client-side by design — it can
// only create charges against your account, never read secret data.
// Falls back to null if not configured, in which case the payment
// panel below stays hidden rather than crashing.
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

function StripeCheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setConfirming(true);
    setPayError(null);
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) {
      setPayError(error.message ?? 'Payment failed');
    } else {
      onSuccess();
    }
    setConfirming(false);
  }

  return (
    <div className="mt-4">
      <PaymentElement />
      {payError && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2 mt-3">
          {payError}
        </div>
      )}
      <button
        onClick={handleConfirm}
        disabled={!stripe || confirming}
        className="w-full mt-3 bg-[var(--color-ink)] hover:bg-black text-white font-medium text-sm
                   rounded-md py-2.5 transition-colors disabled:opacity-60"
      >
        {confirming ? 'Processing…' : 'Confirm Payment'}
      </button>
    </div>
  );
}

function PaymentPanel({ billingBatchId }: { billingBatchId: string }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  async function startPayment() {
    setError(null);
    try {
      const res = await api.post<{ clientSecret: string; amount: number }>('/payments/create', {
        billingBatchId,
      });
      setClientSecret(res.clientSecret);
      setAmount(res.amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
    }
  }

  if (!stripePromise) {
    return (
      <p className="text-xs text-[var(--color-concrete)] mt-3">
        Payment collection requires VITE_STRIPE_PUBLISHABLE_KEY to be set in the frontend .env.
      </p>
    );
  }

  if (paid) {
    return (
      <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-md px-3 py-2 mt-3">
        Payment confirmed for batch {billingBatchId.slice(0, 8)}.
      </div>
    );
  }

  return (
    <div className="mt-3">
      {!clientSecret && (
        <button
          onClick={startPayment}
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          Collect Payment
        </button>
      )}
      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2 mt-2">
          {error}
        </div>
      )}
      {clientSecret && (
        <>
          {amount !== null && (
            <p className="text-sm text-[var(--color-ink-soft)] mb-2">
              Amount due: <span className="font-mono">${amount.toFixed(2)}</span>
            </p>
          )}
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripeCheckoutForm onSuccess={() => setPaid(true)} />
          </Elements>
        </>
      )}
    </div>
  );
}

export function BillingPage() {
  const [propertyId, setPropertyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<SyncFailure[]>([]);

  useEffect(() => {
    api.get<SyncFailure[]>('/qbo/sync-failures').then(setFailures).catch(() => {});
  }, []);

  async function handleCreateBatch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCreatedBatchId(null);
    try {
      const res = await api.post<{ billingBatchId: string; workOrdersBatched: number }>(
        '/billing/consolidated-statement',
        { propertyId, startDate, endDate }
      );
      setResult(`Created batch ${res.billingBatchId} with ${res.workOrdersBatched} work order(s).`);
      setCreatedBatchId(res.billingBatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create statement');
    }
  }

  async function retryFailure(failureId: string) {
    try {
      await api.post(`/qbo/sync-failures/${failureId}/retry`);
      setFailures((prev) => prev.filter((f) => f.id !== failureId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Billing
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Batch completed work orders into a single consolidated statement per property.
      </p>

      <form
        onSubmit={handleCreateBatch}
        className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 space-y-4 mb-8"
      >
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Property ID</label>
          <input
            required
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm font-mono"
            placeholder="uuid"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Period Start</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Period End</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {result && (
          <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-md px-3 py-2">
            {result}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]
                     text-white font-medium text-sm rounded-md py-2.5 transition-colors"
        >
          Create Consolidated Statement
        </button>
      </form>

      {createdBatchId && (
        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 mb-8">
          <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-1">
            Collect Payment
          </h2>
          <p className="text-xs text-[var(--color-concrete)]">
            Batch {createdBatchId.slice(0, 8)} — corporate AP payment for this statement.
          </p>
          <PaymentPanel billingBatchId={createdBatchId} />
        </div>
      )}

      {failures.length > 0 && (
        <div className="boundary-line">
          <div className="bg-[var(--color-danger-soft)] rounded-xl border border-[var(--color-danger)]/30 p-6 mt-2">
            <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-danger)] mb-4">
              QuickBooks Sync Failures
            </h2>
            <div className="space-y-3">
              {failures.map((f) => (
                <div key={f.id} className="flex items-center justify-between bg-white rounded-md p-3 text-sm">
                  <div>
                    <div className="font-mono text-xs text-[var(--color-concrete)]">
                      Batch {f.billing_batch_id.slice(0, 8)}
                    </div>
                    <div className="text-[var(--color-danger)]">{f.error_message}</div>
                  </div>
                  <button
                    onClick={() => retryFailure(f.id)}
                    className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
