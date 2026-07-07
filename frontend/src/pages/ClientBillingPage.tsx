import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Receipt } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, TableSkeleton, MetricCard } from '../components/UIState';

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
  const [statements, setStatements] = useState<Statement[] | null>(null);
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

  const unpaid = statements?.filter((s) => !paidIds.has(s.id)) ?? [];
  const outstandingTotal = unpaid.reduce((sum, s) => sum + Number(s.total_amount), 0);

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

      {statements !== null && statements.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <MetricCard
            label="Outstanding Balance"
            value={`$${outstandingTotal.toFixed(2)}`}
            tone={outstandingTotal > 0 ? 'danger' : 'success'}
          />
          <MetricCard label="Statements" value={String(statements.length)} />
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        {statements === null && <TableSkeleton columns={5} rows={3} />}

        {statements !== null && statements.length === 0 && (
          <EmptyState
            icon={<Receipt size={22} />}
            title="No statements yet"
            description="Your consolidated statements will appear here once a billing period is closed out."
          />
        )}

        {statements !== null && statements.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Amount Due</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id} className="border-b last:border-0 border-[var(--color-concrete-light)] align-top">
                  <td className="px-5 py-3.5">{s.property_name}</td>
                  <td className="px-5 py-3.5 text-xs">{s.billing_period_start} to {s.billing_period_end}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">${Number(s.total_amount).toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={[
                        'inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                        paidIds.has(s.id)
                          ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                          : 'bg-[var(--color-concrete-light)] text-[var(--color-concrete)]',
                      ].join(' ')}
                    >
                      {paidIds.has(s.id) ? 'Paid' : s.batch_status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
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
        )}
      </div>

      {payingId && clientSecret && stripePromise && (
        <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 mt-6">
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
