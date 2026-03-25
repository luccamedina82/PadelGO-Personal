import { argTodayStr } from '@/lib/date'
import Link from 'next/link'

function offsetWeek(dateStr: string, weeks: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export default function WeekNavigation({ weekStart }: { weekStart: string }) {
  const today = argTodayStr()
  const prevWeek = offsetWeek(weekStart, -1)
  const nextWeek = offsetWeek(weekStart, 1)

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Link
        href={`/admin/reservas?date=${prevWeek}&view=week`}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-text hover:border-border-hover transition-colors"
        title="Semana anterior"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </Link>
      <Link
        href={`/admin/reservas?date=${today}&view=week`}
        className="px-2.5 py-1 bg-accent/10 border border-accent/30 rounded-lg text-[11px] text-accent font-semibold hover:bg-accent/20 transition-colors"
      >
        Esta semana
      </Link>
      <Link
        href={`/admin/reservas?date=${nextWeek}&view=week`}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-text hover:border-border-hover transition-colors"
        title="Semana siguiente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  )
}
