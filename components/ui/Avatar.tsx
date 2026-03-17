interface AvatarProps {
  name: string
  color: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  avatarUrl?: string | null
  className?: string
}

const sizeMap = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

export default function Avatar({ name, color, size = 'md', avatarUrl, className }: AvatarProps) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  const sizeClass = sizeMap[size]

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className ?? ''}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${className ?? ''}`}
      style={{ backgroundColor: color + '22', color }}
    >
      {initials}
    </div>
  )
}
