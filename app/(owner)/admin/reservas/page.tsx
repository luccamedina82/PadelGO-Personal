import { argTodayStr, getWeekStart, addDays } from '@/lib/date'
import { getAdminContext } from '@/lib/dal/admin'
import { getBaseBookingRule, getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getConflictBookings } from '@/features/reservas/dal/conflicts'
import BookingsClient from './BookingsClient'
import { Suspense } from 'react'
import { prepareGridData } from '@/lib/utils/gridHelpers'
import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

export type DayGridData = {
  courtColumns: CourtColumn[]
  baseStart: number
  baseEnd: number
  baseBookingRule: { startTime: string; endTime: string; price: number | null } | null
}

interface Props {
  searchParams: Promise<{ date?: string; highlight?: string }>
}

export default async function ReservasPage({ searchParams }: Props) {
  const { date: dateParam, highlight: highlightParam } = await searchParams
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const selectedDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : argTodayStr()

  const weekStart = getWeekStart(selectedDate)
  const weekEnd = addDays(weekStart, 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const [[{ courts: allCourts, clubRules }, conflicts, initialBookings], baseRules] =
    await Promise.all([
      Promise.all([
        getCourtsByClubId(club.id),
        getConflictBookings(club.id),
        fetchBookingsAction(club.id, weekStart, weekEnd),
      ]),
      Promise.all(weekDays.map((day) => getBaseBookingRule(club.id, day))),
    ])

  const weekData: Record<string, DayGridData> = {}
  weekDays.forEach((day, i) => {
    const dayOfWeek = new Date(`${day}T00:00:00.000Z`).getUTCDay()
    const rule = baseRules[i] ?? null
    const { courtColumns, baseStart, baseEnd } = prepareGridData(
      allCourts,
      clubRules,
      rule,
      dayOfWeek
    )
    weekData[day] = {
      courtColumns,
      baseStart,
      baseEnd,
      baseBookingRule: rule
        ? { startTime: rule.startTime, endTime: rule.endTime, price: rule.price }
        : null,
    }
  })

  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-muted text-sm">Sincronizando calendario...</p>
      }
    >
      <BookingsClient
        initialBookings={initialBookings}
        clubId={club.id}
        clubName={club.name}
        weekStart={weekStart}
        initialSelectedDate={selectedDate}
        weekData={weekData}
        conflicts={conflicts.map((c) => ({ id: c.id, dateStr: c.dateStr }))}
        highlightBookingId={highlightParam}
      />
    </Suspense>
  )
}
