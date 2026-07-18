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
// Contrast-audit fix: 5 of these 7 had drifted out of sync with the actual
// index.css token values (pending_review and billing_approved were the only
// two that genuinely matched), which silently broke the bar/pill parity this
// file's header comment promises. Corrected to mirror index.css exactly —
// including the 3 values darkened there for WCAG AA pill-text contrast, so
// bar and pill still read as the same color after that fix.
export const STATUS_HEX: Record<string, string> = {
  pending_review: '#595e6a',   // --color-status-submitted
  priced: '#706010',           // --color-status-priced
  approved: '#532aae',         // --color-status-approved
  scheduled: '#115256',        // --color-status-scheduled
  completed: '#15803D',        // --color-status-completed
  billing_approved: '#544699', // --color-status-billing
  invoiced: '#1e5c4d',         // --color-status-invoiced
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
