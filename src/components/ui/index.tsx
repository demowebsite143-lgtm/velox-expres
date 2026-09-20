import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark',
  accent: 'bg-accent text-primary-dark hover:bg-accent-dark active:bg-accent-dark font-semibold',
  secondary: 'bg-primary/10 text-primary hover:bg-primary/15',
  outline: 'border border-line bg-surface text-ink hover:border-primary/40 hover:bg-primary/5',
  ghost: 'text-ink-muted hover:bg-primary/5 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-13 px-6 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      style={{ borderRadius: 'var(--radius-button, 12px)' }}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

const FIELD_BASE =
  'w-full rounded-card border border-line bg-surface px-3.5 text-base text-ink transition-colors ' +
  'placeholder:text-ink-muted/70 hover:border-primary/30 focus:border-primary focus:outline-none ' +
  'focus:ring-2 focus:ring-primary/20 disabled:bg-canvas disabled:text-ink-muted';

export interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldWrapperProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="field-label">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, prefix, className, ...rest },
  ref,
) {
  const field = (
    <div className={cn(prefix && 'flex items-stretch')}>
      {prefix && (
        <span className="flex items-center rounded-l-card border border-r-0 border-line bg-canvas px-3 text-base text-ink-muted">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        required={required}
        className={cn(
          FIELD_BASE,
          'h-12',
          prefix && 'rounded-l-none',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
        {...rest}
      />
    </div>
  );

  return label || hint || error ? (
    <Field label={label} hint={hint} error={error} required={required}>
      {field}
    </Field>
  ) : (
    field
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, placeholder, className, children, ...rest },
  ref,
) {
  const field = (
    <select
      ref={ref}
      required={required}
      className={cn(FIELD_BASE, 'h-12 appearance-none bg-[length:16px] pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364728A' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
      }}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );

  return label || hint || error ? (
    <Field label={label} hint={hint} error={error} required={required}>
      {field}
    </Field>
  ) : (
    field
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, ...rest },
  ref,
) {
  const field = (
    <textarea
      ref={ref}
      required={required}
      className={cn(FIELD_BASE, 'min-h-[96px] resize-y py-2.5 leading-relaxed', className)}
      {...rest}
    />
  );
  return label || hint || error ? (
    <Field label={label} hint={hint} error={error} required={required}>
      {field}
    </Field>
  ) : (
    field
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-card border border-line bg-surface p-3.5 transition-colors hover:border-primary/30',
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line text-primary focus:ring-primary/30"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  as: As = 'div',
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <As className={cn('rounded-card border border-line bg-surface shadow-card', className)}>
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line p-4 sm:p-5', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-muted/10 text-ink-muted',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/20 text-primary-dark',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} aria-hidden />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-line', className)} />;
}

/** The one signature motif: a dashed road-marking rule. Used sparingly. */
export function RouteRule({ className }: { className?: string }) {
  return <div className={cn('route-keyline w-full', className)} aria-hidden />;
}
