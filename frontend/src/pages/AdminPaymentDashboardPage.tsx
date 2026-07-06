import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

type PaymentStatusRow = {
  corporate_name: string;
  property_name: string;
  batch_id: string;
  payment_stage: string;
  batch_status: string;
  payment_status: string | null;
  amount: string | null;
  qbo_invoice_id: string | null;
  created_at: string;
};

type AdvanceStatusRow = {
  id: string;
  corporate_name: string;
  advance_amount: string;
};

export function AdminPaymentDashboardPage() {
  const [payments, setPayments] = useState<PaymentStatusRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceStatusRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [paymentData, advanceData] = await Promise.all([
        api.get<PaymentStatusRow[]>('/admin-setup/payment-status'),
        api.get<AdvanceStatusRow[]>('/admin-setup/advance-status'),
      ]);
      setPayments(paymentData);
      setAdvances(advanceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment data');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleClearAdvance(clientId: string) {
    setClearingId(clientId);
    try {
      await api.patch(`/admin-setup/clients/${clientId}/clear-advance`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear advance');
    } finally {
      setClearingId(null);
    }
  }

  function statusBadgeClass(status: string | null) {
    if (status === 'succeeded') return 'text-[var(--color-success)] bg-[var(--color-success-soft)]';
    if (status === 'failed') return 'text-[var(--color-danger)] bg-[var(--color-danger-soft)]';
    return 'text-[var(--color-concrete)] bg-[var(--color-concrete-light)]';
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
          Payment Dashboard
        </h1>
        <p className="text-sm text-[var(--color-concrete)]">
          Payment status and QuickBooks invoice linkage across all clients.
        </p>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {advances.length > 0 && (
        <div className="space-y-2">
          {advances.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between bg-[var(--color-danger-soft)] border border-[var(--color-danger)] rounded-lg px-4 py-3"
            >
              <span className="text-sm text-[var(--color-danger)]">
                ⚠️ Advance payment of ${Number(a.advance_amount).toFixed(2)} is due from{' '}
                <strong>{a.corporate_name}</strong> before work begins.
              </span>
              <button
                onClick={() => handleClearAdvance(a.id)}
                disabled={clearingId === a.id}
                className="text-xs font-medium bg-[var(--color-ink)] hover:bg-black text-white rounded-md px-3 py-1.5 disabled:opacity-60"
              >
                {clearingId === a.id ? 'Clearing…' : 'Mark Cleared'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-concrete)] border-b border-[var(--color-concrete-light)]">
              <th className="pb-2 font-medium">Client</th>
              <th className="pb-2 font-medium">Property</th>
              <th className="pb-2 font-medium">Stage</th>
              <th className="pb-2 font-medium">Amount</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">QBO Invoice</th>
              <th className="pb-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.batch_id} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                <td className="py-2.5">{p.corporate_name}</td>
                <td className="py-2.5">{p.property_name}</td>
                <td className="py-2.5 text-xs capitalize">{p.payment_stage}</td>
                <td className="py-2.5 font-mono text-xs">
                  {p.amount ? `$${Number(p.amount).toFixed(2)}` : '—'}
                </td>
                <td className="py-2.5">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${statusBadgeClass(p.payment_status)}`}>
                    {p.payment_status || 'pending'}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-xs">{p.qbo_invoice_id || '—'}</td>
                <td className="py-2.5 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <p className="text-sm text-[var(--color-concrete)] py-4">No billing batches yet.</p>
        )}
      </div>
    </div>
  );
}
