'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'

export default function ThemeToggle() {
  const { theme, toggle } = useThemeStore()

  // Sync data-theme attribute on mount and on theme change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:border-accent transition-colors text-muted hover:text-accent cursor-pointer"
    >
      {isDark ? (
        // Sun icon — action: switch TO light mode
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon icon — action: switch TO dark mode
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  )
}
