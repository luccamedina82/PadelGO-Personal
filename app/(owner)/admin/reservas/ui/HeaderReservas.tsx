import Link from 'next/link'
import PrintButton from '@/components/ui/PrintButton'

export default function HeaderReservas({
  viewMode,
  weekStart,
  weekEnd,
  club,
  selectedDate,
}: {
  viewMode: 'day' | 'week'
  weekStart: string
  weekEnd: string
  club: { name: string }
  selectedDate: string
}) {
  const weekStartObj = new Date(`${weekStart}T00:00:00.000Z`)
  const weekEndObj = new Date(`${weekEnd}T00:00:00.000Z`)
  const weekLabel = `${weekStartObj.getUTCDate()} – ${weekEndObj.getUTCDate()} ${weekEndObj.toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })}`

  const selectedDateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dateLabel = selectedDateObj.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold text-muted uppercase tracking-widest leading-none mb-1">{club.name}</p>
        <h1 className="font-display text-3xl font-bold text-text capitalize leading-none print:text-xl">
          {viewMode === 'week' ? weekLabel : dateLabel}
        </h1>
      </div>
      <div className="flex items-center gap-2 print:hidden">
        {/* View toggle */}
        <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden divide-x divide-border">
          <Link
            href={`/admin/reservas?date=${selectedDate}&view=day`}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'day' ? 'bg-accent text-accent-text' : 'text-muted hover:text-text hover:bg-card-hover'
            }`}
          >
            Día
          </Link>
          <Link
            href={`/admin/reservas?date=${selectedDate}&view=week`}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'week' ? 'bg-accent text-accent-text' : 'text-muted hover:text-text hover:bg-card-hover'
            }`}
          >
            Semana
          </Link>
        </div>
        <PrintButton />
        <Link
          href={`/admin/reservas/nueva?date=${selectedDate}&view=${viewMode}`}
          prefetch
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-text
                         text-sm font-bold rounded-xl hover:bg-accent-dark transition-colors shadow-sm"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva reserva
        </Link>
      </div>
    </div>
  )
}
