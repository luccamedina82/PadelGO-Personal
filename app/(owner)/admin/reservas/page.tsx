import { argTodayStr } from '@/lib/date'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import HeaderReservas from './ui/HeaderReservas'
import DateNavigation from './ui/DayView/DayView'
import WeekNavigation from './ui/WeeklyView/WeeklyView'
import BookingsClient from './BookingsClient'
import { Suspense } from 'react'

interface Props {
  searchParams: Promise<{ date?: string; new?: string; view?: 'day' | 'week' }>
}

function todayStr() {
  return argTodayStr()
}

function getMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day // Adjust so Monday is first day
  d.setUTCDate(d.getUTCDate() + diff)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []
  const start = new Date(`${weekStart}T00:00:00.000Z`)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    dates.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    )
  }
  return dates
}

export default async function ReservasPage({ searchParams }: Props) {
  const { date: dateParam, view: viewParam } = await searchParams
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  const viewMode = viewParam === 'week' ? 'week' : 'day'

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }
  const allCourts = await getCourtsByClubId(club.id)

  const selectedDate = dateParam ?? todayStr()
  const dateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  // Week view: calculate week start (Monday) and end (Sunday)
  const weekStart = getMonday(selectedDate)
  const weekDates = getWeekDates(weekStart)
  const weekEnd = weekDates[6]
  const dayOfWeek = dateObj.getUTCDay()

  const periodStart = new Date(`${weekStart}T00:00:00.000Z`)
  const periodEnd = new Date(`${weekEnd}T23:59:59.999Z`)

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

  const courtColumns: CourtColumn[] = activeCourtsToday.map((c) => ({
    id: c.id,
    name: c.name,
    isActive: true,
  }))

  const selectedDateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dateLabel = selectedDateObj.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  // Week label for week view
  const weekStartObj = new Date(`${weekStart}T00:00:00.000Z`)
  const weekEndObj = new Date(`${weekEnd}T00:00:00.000Z`)
  const weekLabel = `${weekStartObj.getUTCDate()} – ${weekEndObj.getUTCDate()} ${weekEndObj.toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })}`

  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border print:static print:border-0">
        {/* Title row */}
        <HeaderReservas
          viewMode={viewMode}
          weekStart={weekStart}
          weekEnd={weekEnd}
          club={club}
          selectedDate={selectedDate}
        />
        {/* Date / Week navigation strip */}
        {viewMode === 'day' ? (
          <DateNavigation selectedDate={selectedDate} />
        ) : (
          <WeekNavigation weekStart={weekStart} />
        )}
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 print:overflow-visible print:h-auto">
        <Suspense fallback={<p className="p-8 text-center text-muted text-sm">Sincronizando calendario...</p>}>
          <BookingsClient
            initialBookings={initialBookings}
            clubId={club.id}
            date={selectedDate}
            weekStart={weekStart}
            weekEnd={weekEnd}
            viewMode={viewMode}
            courts={courtColumns}
            gridStart={gridStart}
            gridEnd={gridEnd}
          />
        </Suspense>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block fixed top-0 left-0 right-0 bg-white p-4 border-b">
        <h1 className="text-lg font-bold">{viewMode === 'week' ? weekLabel : dateLabel}</h1>
        <p className="text-sm text-gray-600">{club.name}</p>
      </div>
    </div>
  )
}
