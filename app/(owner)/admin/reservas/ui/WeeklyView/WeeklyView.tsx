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
    <div className="px-5 pb-2 flex items-center gap-2 print:hidden">
      <Link
        href={`/admin/reservas?date=${prevWeek}&view=week`}
        className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted hover:text-text hover:border-border-hover transition-colors"
      >
        ← Anterior
      </Link>
      <Link
        href={`/admin/reservas?date=${today}&view=week`}
        className="px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-lg text-xs text-accent font-semibold hover:bg-accent/20 transition-colors"
      >
        Esta semana
      </Link>
      <Link
        href={`/admin/reservas?date=${nextWeek}&view=week`}
        className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted hover:text-text hover:border-border-hover transition-colors"
      >
        Siguiente →
      </Link>
    </div>
  )
}
