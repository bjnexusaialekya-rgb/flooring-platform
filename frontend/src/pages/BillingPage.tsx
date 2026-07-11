import { useEffect, useState, type FormEvent } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { FileText } from 'lucide-react';
import { api, downloadFile } from '../lib/api';
import { EmptyState, TableSkeleton, MetricCard } from '../components/UIState';
import { Button } from '../components/Button';

type SyncFailure = { id: string; billing_batch_id: string; error_message: string; failed_at: string };
type BillingBatch = {
  id: string;
  batch_status: string;
  qbo_invoice_id: string | null;
  billing_period_start: string;
  billing_period_end: string;
  created_at: string;
  property_name: string;
};

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
      <Button
        onClick={handleConfirm}
        disabled={!stripe}
        isLoading={confirming}
        className="w-full mt-3"
      >
        {confirming ? 'Processing…' : 'Confirm Payment'}
      </Button>
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
        <Button variant="ghost" onClick={startPayment} className="!px-0 !py-0 !bg-transparent text-[var(--color-link)] hover:underline">
          Collect Payment
        </Button>
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
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<SyncFailure[]>([]);
  const [qboSyncing, setQboSyncing] = useState(false);
  const [qboResult, setQboResult] = useState<string | null>(null);
  const [batches, setBatches] = useState<BillingBatch[] | null>(null);

  useEffect(() => {
    api.get<SyncFailure[]>('/qbo/sync-failures').then(setFailures).catch(() => {});
    api.get<BillingBatch[]>('/billing/batches').then(setBatches).catch(() => {});
    api.get<{ id: string; name: string }[]>('/units/properties').then(setProperties).catch(() => {});
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
      api.get<BillingBatch[]>('/billing/batches').then(setBatches).catch(() => {});
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

  async function syncToQuickBooks(batchId: string) {
    setQboSyncing(true);
    setQboResult(null);
    try {
      const res = await api.post<{ success: boolean; qboInvoiceId: string; alreadySynced?: boolean }>(`/qbo/batches/${batchId}/sync`);
      setQboResult(res.alreadySynced ? `Already synced (Invoice ${res.qboInvoiceId})` : `Synced to QuickBooks (Invoice ${res.qboInvoiceId})`);
    } catch (err) {
      setQboResult(err instanceof Error ? `QuickBooks sync failed: ${err.message}` : 'QuickBooks sync failed');
    } finally {
      setQboSyncing(false);
    }
  }

  const syncedCount = batches?.filter((b) => b.qbo_invoice_id).length ?? 0;

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Billing
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Batch completed work orders into a single consolidated statement per property.
      </p>

      {batches !== null && batches.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard label="Statements" value={String(batches.length)} />
          <MetricCard label="Synced to QBO" value={String(syncedCount)} tone="success" />
          <MetricCard
            label="Sync Failures"
            value={String(failures.length)}
            tone={failures.length > 0 ? 'danger' : 'default'}
          />
        </div>
      )}

      <form
        onSubmit={handleCreateBatch}
        className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 space-y-4 mb-8"
      >
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Property</label>
          <select
            required
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
          >
            <option value="">Select a property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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

        <Button type="submit" className="w-full">
          Create Consolidated Statement
        </Button>
      </form>

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden mb-8">
        <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] px-6 pt-6 mb-4">
          Existing Statements
        </h2>

        {batches === null && <TableSkeleton columns={4} rows={3} />}

        {batches !== null && batches.length === 0 && (
          <EmptyState
            icon={<FileText size={22} />}
            title="No statements yet"
            description="Create a consolidated statement above once work orders are ready to bill."
          />
        )}

        {batches !== null && batches.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
                <th className="pb-2 pl-6 font-medium">Property</th>
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 pr-6 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                  <td className="py-2.5 pl-6 text-[#0a0a0a] font-semibold">{b.property_name}</td>
                  <td className="py-2.5 text-xs">{b.billing_period_start} to {b.billing_period_end}</td>
                  <td className="py-2.5">
                    <span
                      className={[
                        'inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                        b.qbo_invoice_id
                          ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                          : 'bg-[var(--color-concrete-light)] text-[var(--color-concrete)]',
                      ].join(' ')}
                    >
                      {b.qbo_invoice_id ? 'Synced to QBO' : b.batch_status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-6">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" onClick={() => setCreatedBatchId(b.id)} className="!px-0 !py-0 !bg-transparent text-[var(--color-link)] hover:underline">
                        Open
                      </Button>
                      {b.qbo_invoice_id && (
                        <Button
                          variant="ghost"
                          onClick={() => downloadFile(`/qbo/batches/${b.id}/pdf`, `Invoice-${b.qbo_invoice_id}.pdf`)}
                          className="!px-0 !py-0 !bg-transparent text-[var(--color-link)] hover:underline"
                        >
                          Download PDF
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createdBatchId && (
        <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 mb-8">
          <h2 className="font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-1">
            Collect Payment
          </h2>
          <p className="text-xs text-[var(--color-concrete)]">
            Batch {createdBatchId.slice(0, 8)} — corporate AP payment for this statement.
          </p>
          <PaymentPanel billingBatchId={createdBatchId} />

          <Button
            variant="ghost"
            onClick={() => syncToQuickBooks(createdBatchId)}
            isLoading={qboSyncing}
            className="mt-4 !px-0 !py-0 !bg-transparent text-[var(--color-link)] hover:underline"
          >
            {qboSyncing ? 'Syncing to QuickBooks…' : 'Sync to QuickBooks'}
          </Button>
          {qboResult && (
            <div className="text-sm text-[var(--color-ink-soft)] bg-[var(--color-panel)] border border-[var(--color-concrete-light)] rounded-md px-3 py-2 mt-2">
              {qboResult}
            </div>
          )}
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
                  <Button variant="ghost" onClick={() => retryFailure(f.id)} className="!px-0 !py-0 !bg-transparent text-[var(--color-link)] hover:underline">
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
