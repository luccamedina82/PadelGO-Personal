import { argTodayStr } from '@/lib/date'
import NuevaReservaButton from './ui/NuevaReservaButton'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { getAdminContext } from '@/lib/dal/admin'
import { getBaseBookingRule, getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import { getConflictBookings } from '@/features/reservas/dal/conflicts'
import DateHeader from './ui/DateHeader/DateHeader'
import BookingsClient from './BookingsClient'
import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import { prepareGridData } from '@/lib/utils/gridHelpers'
import { fetchBookingsByDateAction } from '@/actions/owner/bookings'

interface Props {
  searchParams: Promise<{ date?: string; new?: string; highlight?: string }>
}

function todayStr() {
  return argTodayStr()
}

export default async function ReservasPage({ searchParams }: Props) {
  const { date: dateParam, highlight: highlightParam } = await searchParams
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }
  
  const selectedDate = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) ? dateParam : todayStr()
  const dateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dayOfWeek = dateObj.getUTCDay()

  const [{ courts: allCourts, clubRules }, conflicts, baseBookingRule, initialBookings] = await Promise.all([
    getCourtsByClubId(club.id),
    getConflictBookings(club.id),
    getBaseBookingRule(club.id, selectedDate),
    fetchBookingsByDateAction(club.id, selectedDate)
  ])

  const { courtColumns, baseStart, baseEnd } = prepareGridData(allCourts, clubRules, baseBookingRule, dayOfWeek)

  const dateLabel = dateObj.toLocaleDateString('es-AR', {
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
            baseStart={baseStart}
            baseEnd={baseEnd}
            conflicts={conflicts.map((c) => ({ id: c.id, dateStr: c.dateStr }))}
            highlightBookingId={highlightParam}
            baseBookingRule={baseBookingRule}
          />
        </Suspense>
      </div>
    </div>
  )
}
