import { clsx } from 'clsx'

type BadgeVariant = 'accent' | 'green' | 'yellow' | 'red' | 'muted' | 'purple'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  accent: 'bg-accent/10 text-accent border border-accent/20',
  green: 'bg-green-500/10 text-green-400 border border-green-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  red: 'bg-red-500/10 text-red-400 border border-red-500/20',
  muted: 'bg-surface text-muted border border-border',
  purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
}

export default function Badge({ label, variant = 'muted', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
        variantClasses[variant],
        className
      )}
    >
      {label}
    </span>
  )
}
