import { useEffect, useState, type FormEvent } from 'react';
import { FolderKanban } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, TableSkeleton } from '../components/UIState';

type Tracker = {
  id: string;
  project_name: string;
  property_name: string;
  status: string;
  start_date: string;
  target_end_date: string;
  summary_labor_total: string;
  summary_material_total: string;
};

const TRACKER_STATUS_STYLES: Record<string, string> = {
  active: 'bg-[var(--color-status-approved-soft)] text-[var(--color-status-approved)]',
  on_hold: 'bg-[var(--color-status-submitted-soft)] text-[var(--color-status-submitted)]',
  completed: 'bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]',
};

function TrackerStatusPill({ status }: { status: string }) {
  const style =
    TRACKER_STATUS_STYLES[status] ?? 'bg-[var(--color-concrete-light)] text-[var(--color-ink-soft)]';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function ProjectTrackerPage() {
  const [trackers, setTrackers] = useState<Tracker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');

  function load() {
    api.get<Tracker[]>('/project-trackers').then(setTrackers).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/project-trackers', { propertyId, projectName, startDate, targetEndDate });
      setShowForm(false);
      setPropertyId('');
      setProjectName('');
      setStartDate('');
      setTargetEndDate('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  }

  async function updateSummary(id: string, field: 'summaryLaborTotal' | 'summaryMaterialTotal', value: string) {
    try {
      await api.patch(`/project-trackers/${id}/summary`, { [field]: Number(value) || 0 });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update summary');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Project Trackers
          </h1>
          <p className="text-sm text-[var(--color-concrete)] mt-1">
            Lightweight tracking for 2–4 week projects. Summary totals only — feeds directly into
            consolidated billing, not a separate invoice type.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white
                     text-sm font-medium px-4 py-2.5 rounded-md transition-colors"
        >
          + New Project
        </button>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] p-6 space-y-4 mb-6"
        >
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Project Name</label>
              <input
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
                placeholder="Oakridge Phase 2 Renovation"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Target End Date</label>
              <input
                type="date"
                required
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-concrete-light)] text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]
                       text-white font-medium text-sm rounded-md py-2.5 transition-colors"
          >
            Create Project
          </button>
        </form>
      )}

      <div className="bg-[var(--color-panel)] rounded-xl border surface-card border-[var(--color-concrete-light)] overflow-hidden">
        {trackers === null && <TableSkeleton columns={5} rows={4} />}

        {trackers !== null && trackers.length === 0 && (
          <EmptyState
            icon={<FolderKanban size={22} />}
            title="No projects tracked yet"
            description="Longer 2–4 week projects will appear here once created — summary totals feed straight into consolidated billing."
          />
        )}

        {trackers !== null && trackers.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-concrete-light)] text-left text-xs uppercase tracking-wide text-[var(--color-concrete)]">
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Labor Total</th>
                <th className="px-5 py-3 font-medium">Material Total</th>
              </tr>
            </thead>
            <tbody>
              {trackers.map((t) => (
                <tr key={t.id} className="border-b last:border-0 border-[var(--color-concrete-light)]">
                  <td className="px-5 py-3.5">{t.project_name}</td>
                  <td className="px-5 py-3.5 text-[var(--color-concrete)]">{t.property_name}</td>
                  <td className="px-5 py-3.5">
                    <TrackerStatusPill status={t.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={t.summary_labor_total}
                      onBlur={(e) => updateSummary(t.id, 'summaryLaborTotal', e.target.value)}
                      className="w-24 px-2 py-1 rounded border border-[var(--color-concrete-light)] font-mono text-xs"
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={t.summary_material_total}
                      onBlur={(e) => updateSummary(t.id, 'summaryMaterialTotal', e.target.value)}
                      className="w-24 px-2 py-1 rounded border border-[var(--color-concrete-light)] font-mono text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
