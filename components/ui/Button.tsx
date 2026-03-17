import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'accent' | 'ghost' | 'outline' | 'surface'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  accent: 'bg-accent text-accent-text hover:bg-accent-dark font-semibold',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-card',
  outline: 'bg-transparent border border-border text-text hover:border-border-hover hover:bg-card',
  surface: 'bg-surface text-text hover:bg-card border border-border',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export default function Button({
  variant = 'accent',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
