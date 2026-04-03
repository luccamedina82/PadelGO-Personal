import { argTodayStr } from '@/lib/date'
import NuevaReservaButton from './ui/NuevaReservaButton'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import { getConflictBookings } from '@/features/reservas/dal/conflicts'
import DateHeader from './ui/DateHeader/DateHeader'
import BookingsClient from './BookingsClient'
import { Suspense } from 'react'
import prisma from '@/lib/prisma'

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

  const [{ courts: allCourts, clubRules }, conflicts, baseBookingRule] = await Promise.all([
    getCourtsByClubId(club.id),
    getConflictBookings(club.id),
    prisma.bookingRule.findFirst({
      where: {
        clubId: club.id,
        priority: 0,
        isActive: true,
        courtIds: { isEmpty: true },
        AND: [
          // Compare against the full day range to avoid UTC offset false misses
          { OR: [{ activeFrom: null }, { activeFrom: { lte: new Date(`${selectedDate}T23:59:59.999Z`) } }] },
          { OR: [{ activeUntil: null }, { activeUntil: { gte: new Date(`${selectedDate}T00:00:00.000Z`) } }] },
        ],
      },
      orderBy: { activeFrom: 'desc' },
      select: { startTime: true, endTime: true, price: true },
    }),
  ])

  const periodStart = new Date(`${selectedDate}T00:00:00.000Z`)
  const periodEnd = new Date(`${selectedDate}T23:59:59.999Z`)

  const initialBookings = await getAdminBookingsByDate(club.id, periodStart, periodEnd)

  const activeCourtsToday = allCourts.map((court) => ({
    ...court,
    availabilities: court.availabilities.filter((a) => a.dayOfWeek === dayOfWeek),
  }))

  let baseStart = 8 * 60
  let baseEnd = 23 * 60

  if (baseBookingRule) {
    const [sh, sm] = baseBookingRule.startTime.split(':').map(Number)
    const [eh, em] = baseBookingRule.endTime.split(':').map(Number)
    baseStart = (sh ?? 8) * 60 + (sm ?? 0)
    baseEnd = (eh ?? 23) * 60 + (em ?? 0)
  }

  const clubAllowedDurations = [...new Set(clubRules.flatMap((r) => r.allowedDurations))].sort((a, b) => a - b)

  const courtColumns: CourtColumn[] = activeCourtsToday.filter((c) => !c.hideFromGrid).map((c) => {
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
    const courtRuleDurations = [...new Set(c.bookingRule.flatMap((r) => r.allowedDurations))].sort((a, b) => a - b)
    const allowedDurations = courtRuleDurations.length > 0
      ? courtRuleDurations
      : clubAllowedDurations.length > 0
        ? clubAllowedDurations
        : [60, 90, 120]
    return {
      id: c.id,
      name: c.name,
      isActive: c.availabilities.length > 0,
      isUnderMaintenance: c.isUnderMaintenance,
      hideFromGrid: c.hideFromGrid,
      closeTimeMinutes,
      openTimeMinutes,
      allowedDurations,
    }
  })

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
