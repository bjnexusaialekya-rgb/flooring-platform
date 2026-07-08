import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export function KebabMenu({ actions }: { actions: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (open) {
      setActiveIndex(-1);
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % actions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? actions.length - 1 : i - 1));
    }
  };

  return (
    <div
      ref={ref}
      onKeyDown={handleKeyDown}
      className="relative inline-block text-left opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
    >
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md hover:bg-[var(--color-ink-soft)]/10"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-md bg-[var(--color-panel)] border border-[var(--color-concrete-light)] z-10 overflow-hidden animate-dropdown-in"
          style={{ boxShadow: 'var(--elevation-2)' }}
        >
          {actions.map((a, i) => (
            <button
              key={i}
              ref={(el) => { itemRefs.current[i] = el; }}
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); a.onClick(); setOpen(false); }}
              className="block w-full text-left px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-primary-soft)] focus:bg-[var(--color-primary-soft)] focus:outline-none"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
