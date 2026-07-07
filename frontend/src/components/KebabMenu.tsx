import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export function KebabMenu({ actions }: { actions: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div
      ref={ref}
      className="relative inline-block text-left opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
    >
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md hover:bg-[var(--color-ink-soft)]/10"
        aria-label="Row actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-md shadow-lg bg-[var(--color-panel)] border border-[var(--color-concrete-light)] z-10 overflow-hidden">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); a.onClick(); setOpen(false); }}
              className="block w-full text-left px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-primary-soft)]"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
