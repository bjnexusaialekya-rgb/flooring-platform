import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

// Shared styled <select> — wraps the native element (so all existing
// keyboard/accessibility/form behavior is untouched) but hides the
// browser-default arrow and draws a themed one instead, and matches the
// same border/focus-ring treatment used on <input> across the app. Native
// selects were the one input type that never got themed, so every screen
// using them (Billing, Add Company, Add Login, Work Order filters) had a
// visibly different, browser-default control sitting next to styled ones.
export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={
          'w-full appearance-none px-3 py-2 pr-9 rounded-md border border-[var(--color-concrete-light)] text-sm bg-white ' +
          'transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] ' +
          'disabled:opacity-50 disabled:cursor-not-allowed ' +
          className
        }
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-concrete)]"
      />
    </div>
  );
}
