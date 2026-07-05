import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../lib/api';

type Statement = {
  id: string;
  batch_status: string;
  qbo_invoice_id: string | null;
  billing_period_start: string;
  billing_period_end: string;
  property_name: string;
  total_amount: string;
};

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
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
        className="w-full mt-3 bg-[var(--color-ink)] hover:bg-black text-white font-medium text-sm rounded-md py-2.5 transition-colors disabled:opacity-60"
      >
        {confirming ? 'Processing…' : 'Confirm Payment'}
      </button>
    </div>
  );
}

export function ClientBillingPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<Statement[]>('/client-billing/my-statements').then(setStatements).catch((err) => setError(err.message));
  }, []);

  async function startPayment(billingBatchId: string) {
    setError(null);
    setPayingId(billingBatchId);
    setClientSecret(null);
    try {
      const res = await api.post<{ clientSecret: string }>('/client-billing/pay', { billingBatchId });
      setClientSecret(res.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Billing
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Your consolidated monthly statements.
      </p>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
              <th className="pb-2 font-medium">Property</th>
              <th className="pb-2 font-medium">Period</th>
              <th className="pb-2 font-medium">Amount Due</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {statements.map((s) => (
              <tr key={s.id} className="border-b last:border-0 border-[var(--color-concrete-light)] align-top">
                <td className="py-2.5">{s.property_name}</td>
                <td className="py-2.5 text-xs">{s.billing_period_start} to {s.billing_period_end}</td>
                <td className="py-2.5 font-mono text-xs">${Number(s.total_amount).toFixed(2)}</td>
                <td className="py-2.5 text-xs">{paidIds.has(s.id) ? 'Paid' : s.batch_status}</td>
                <td className="py-2.5">
                  {!paidIds.has(s.id) && stripePromise && (
                    <button
                      onClick={() => startPayment(s.id)}
                      className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      Pay Now
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {statements.length === 0 && (
          <p className="text-sm text-[var(--color-concrete)] py-4">No statements yet.</p>
        )}
      </div>

      {payingId && clientSecret && stripePromise && (
        <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 mt-6">
          <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-1">
            Complete Payment
          </h2>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm
              onSuccess={() => {
                setPaidIds((prev) => new Set(prev).add(payingId));
                setPayingId(null);
                setClientSecret(null);
              }}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}
