import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  isLoading,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseStyle =
    "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md " +
    "transition-colors active:scale-[0.99] cursor-pointer focus:outline-none focus:ring-2 " +
    "focus:ring-[var(--color-primary)]/30 disabled:opacity-50 disabled:pointer-events-none";

  const variants: Record<string, string> = {
    primary: "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white shadow-sm",
    secondary: "bg-[var(--color-panel)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-concrete-light)]",
    ghost: "bg-transparent hover:bg-[var(--color-concrete-light)]/40 text-[var(--color-ink-soft)]",
    destructive: "bg-[var(--color-danger)] hover:opacity-90 text-white shadow-sm focus:ring-[var(--color-danger)]/30",
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};
