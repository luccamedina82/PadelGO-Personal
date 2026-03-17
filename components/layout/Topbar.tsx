// Server Component — Page topbar with title and optional actions slot
import ThemeToggle from './ThemeToggle'

interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  showThemeToggle?: boolean
}

export default function Topbar({ title, subtitle, actions, showThemeToggle = false }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-sm border-b border-border px-4 md:px-6 h-14 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        {title && <h1 className="text-base font-semibold text-text truncate">{title}</h1>}
        {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}

      {showThemeToggle && (
        <div className="flex-shrink-0">
          <ThemeToggle />
        </div>
      )}
    </header>
  )
}
