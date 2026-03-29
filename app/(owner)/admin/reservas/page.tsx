import { argTodayStr } from '@/lib/date'
import NuevaReservaButton from './ui/NuevaReservaButton'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import DateHeader from './ui/DateHeader/DateHeader'
import BookingsClient from './BookingsClient'
import { Suspense } from 'react'

interface Props {
  searchParams: Promise<{ date?: string; new?: string }>
}

function todayStr() {
  return argTodayStr()
}

export default async function ReservasPage({ searchParams }: Props) {
  const { date: dateParam } = await searchParams
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }
  const allCourts = await getCourtsByClubId(club.id)

  const selectedDate = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) ? dateParam : todayStr()
  const dateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dayOfWeek = dateObj.getUTCDay()

  const periodStart = new Date(`${selectedDate}T00:00:00.000Z`)
  const periodEnd = new Date(`${selectedDate}T23:59:59.999Z`)

  const initialBookings = await getAdminBookingsByDate(club.id, periodStart, periodEnd)

  const activeCourtsToday = allCourts.map((court) => ({
    ...court,
    availabilities: court.availabilities.filter((a) => a.dayOfWeek === dayOfWeek),
  }))

  let gridStart = 8 * 60
  let gridEnd = 23 * 60
  const openTimes: number[] = []
  const closeTimes: number[] = []

  activeCourtsToday.forEach((court) => {
    court.availabilities.forEach((avail) => {
      const [oh, om] = avail.openTime.split(':').map(Number)
      const [ch, cm] = avail.closeTime.split(':').map(Number)
      openTimes.push((oh ?? 8) * 60 + (om ?? 0))
      closeTimes.push((ch ?? 23) * 60 + (cm ?? 0))
    })
  })
  if (openTimes.length > 0) gridStart = Math.min(...openTimes)
  if (closeTimes.length > 0) gridEnd = Math.max(...closeTimes)

  gridStart = Math.floor(gridStart / 30) * 30
  gridEnd = Math.ceil(gridEnd / 30) * 30

  const courtColumns: CourtColumn[] = activeCourtsToday.map((c) => {
    let closeTimeMinutes: number | undefined
    let openTimeMinutes: number | undefined
    if (c.availabilities.length > 0) {
      const closeTimes = c.availabilities.map((a) => {
        const [h, m] = a.closeTime.split(':').map(Number)
        return (h ?? 23) * 60 + (m ?? 0)
      })
      const openTimes = c.availabilities.map((a) => {
        const [h, m] = a.openTime.split(':').map(Number)
        return (h ?? 8) * 60 + (m ?? 0)
      })
      closeTimeMinutes = Math.min(...closeTimes)
      openTimeMinutes = Math.min(...openTimes)
    }
    return {
      id: c.id,
      name: c.name,
      isActive: c.availabilities.length > 0,
      closeTimeMinutes,
      openTimeMinutes,
    }
  })

  const selectedDateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dateLabel = selectedDateObj.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border print:static print:border-0">
        <div className="pl-4 pr-4 py-2.5 flex items-center gap-3 print:hidden">
          {/* Nombre del club */}
          <p className="text-[11px] font-bold text-muted uppercase tracking-widest leading-none shrink-0">
            {club.name}
          </p>

          {/* Separador */}
          <div className="w-px h-5 bg-border shrink-0" />

          {/* Navegación de fecha */}
          <DateHeader selectedDate={selectedDate} clubId={club.id} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Nueva reserva */}
          <NuevaReservaButton key={selectedDate}/>
        </div>

        {/* Print-only header */}
        <div className="hidden print:block px-5 py-3">
          <h1 className="text-lg font-bold capitalize">{dateLabel}</h1>
          <p className="text-sm text-gray-600">{club.name}</p>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 print:overflow-visible print:h-auto">
        <Suspense fallback={<p className="p-8 text-center text-muted text-sm">Sincronizando calendario...</p>}>
          <BookingsClient
            initialBookings={initialBookings}
            clubId={club.id}
            date={selectedDate}
            courts={courtColumns}
            gridStart={gridStart}
            gridEnd={gridEnd}
          />
        </Suspense>
      </div>
    </div>
  )
}
