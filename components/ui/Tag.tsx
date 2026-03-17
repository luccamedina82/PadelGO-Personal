import { clsx } from 'clsx'

interface TagProps {
  label: string
  className?: string
}

export default function Tag({ label, className }: TagProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        'bg-tag text-tag-text border border-tag-border',
        className
      )}
    >
      {label}
    </span>
  )
}
