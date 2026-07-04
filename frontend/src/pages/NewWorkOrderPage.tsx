import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { FloorPlanDiagram } from '../components/FloorPlanDiagram';

type Unit = { id: string; unit_number: string; building_identifier: string };
type RoomSpec = { material_sku: string; net_qty: number; waste_pct: number };
type Template = { id: string; plan_name: string; room_manifest: Record<string, RoomSpec> };

export function NewWorkOrderPage() {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [unitId, setUnitId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [targetTurnDate, setTargetTurnDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Unit[]>('/units').then(setUnits).catch(() => {});
    api.get<Template[]>('/floor-plan-templates').then(setTemplates).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ workOrderId: string }>('/work-orders', {
        unitId,
        floorPlanTemplateId: templateId,
        poNumber: poNumber || undefined,
        targetTurnDate: targetTurnDate || undefined,
      });
      navigate(`/work-orders/${res.workOrderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit work order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)] mb-1">
        Submit Work Order
      </h1>
      <p className="text-sm text-[var(--color-concrete)] mb-6">
        Select a unit and floor plan template. Materials and quantities are
        set automatically — pricing is handled internally after submission.
      </p>

      <form onSubmit={handleSubmit} className="bg-[var(--color-panel)] rounded-xl border border-[var(--color-concrete-light)] p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Unit</label>
          <select
            required
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm bg-white"
          >
            <option value="">Select a unit…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.building_identifier} — Unit {u.unit_number}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">
            Floor Plan Template
          </label>
          <select
            required
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm bg-white"
          >
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plan_name}
              </option>
            ))}
          </select>
        </div>

        {templateId && (
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">
              Rooms &amp; Materials Preview
            </label>
            <FloorPlanDiagram
              roomManifest={templates.find((t) => t.id === templateId)?.room_manifest ?? {}}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">
              PO Number (optional)
            </label>
            <input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">
              Target Turn Date
            </label>
            <input
              type="date"
              value={targetTurnDate}
              onChange={(e) => setTargetTurnDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]
                     text-white font-medium text-sm rounded-md py-2.5 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Work Order'}
        </button>
      </form>
    </div>
  );
}
