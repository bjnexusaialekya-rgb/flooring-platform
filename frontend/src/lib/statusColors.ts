// Single source of truth for work-order status colors.
// Both <StatusPill> (WorkOrdersListPage) and the Reports dashboard charts
// import from here, so a status always renders in the same color
// everywhere in the app — fixes the pill-vs-chart color mismatch bug.

export const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Submitted',
  priced: 'Priced',
  approved: 'Approved',
  scheduled: 'Scheduled',
  completed: 'Completed',
  billing_approved: 'Billing',
  invoiced: 'Invoiced',
};

// Soft/text pairs for pill backgrounds — same var names already defined
// in index.css (--color-status-*), just centralized here as one lookup.
export const STATUS_PILL_CLASSES: Record<string, string> = {
  pending_review: 'bg-[var(--color-status-submitted-soft)] text-[var(--color-status-submitted)]',
  priced: 'bg-[var(--color-status-priced-soft)] text-[var(--color-status-priced)]',
  approved: 'bg-[var(--color-status-approved-soft)] text-[var(--color-status-approved)]',
  scheduled: 'bg-[var(--color-status-scheduled-soft)] text-[var(--color-status-scheduled)]',
  completed: 'bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)]',
  billing_approved: 'bg-[var(--color-status-billing-soft)] text-[var(--color-status-billing)]',
  invoiced: 'bg-[var(--color-status-invoiced-soft)] text-[var(--color-status-invoiced)]',
};

// Solid hex values for the same statuses, for use in SVG/canvas contexts
// (Recharts bar fills) where a CSS var string won't resolve the way it
// does in a className. Values match the *-soft pairing's ink tone in
// index.css exactly, so a bar and its pill are visually identical.
export const STATUS_HEX: Record<string, string> = {
  pending_review: '#7d8496', // --color-status-submitted
  priced: '#0e8fa0',         // --color-status-priced
  approved: '#5b5fc7',       // --color-status-approved
  scheduled: '#2f7fb8',      // --color-status-scheduled
  completed: '#1a8a6e',      // --color-status-completed
  billing_approved: '#6d5bc7', // --color-status-billing
  invoiced: '#2f9e6f',       // --color-status-invoiced
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function statusPillClass(status: string): string {
  return STATUS_PILL_CLASSES[status] ?? 'bg-[var(--color-concrete-light)] text-[var(--color-ink-soft)]';
}

export function statusHex(status: string): string {
  return STATUS_HEX[status] ?? '#8a90a1'; // --color-concrete fallback
}
