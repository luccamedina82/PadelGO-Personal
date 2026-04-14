import { argTodayStr, getWeekStart, addDays } from '@/lib/date'
import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getConflictBookings } from '@/features/reservas/dal/conflicts'
import BookingsClient from './BookingsClient'
import BookingsHeader from './BookingsHeader'
import { BookingsProvider, CourtsProvider } from './BookingsContext'
import { Suspense } from 'react'
import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import BookingGridSkeleton from '@/features/reservas/components/booking-grid/BookingGridSkeleton/BookingGridSkeleton'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

interface Props {
  searchParams: Promise<{ date?: string; highlight?: string }>
}

// Used only for the Suspense fallback while courts+bookings load on first visit.
const FALLBACK_COURTS: CourtColumn[] = [
  { id: '1', name: '', isActive: true },
  { id: '2', name: '', isActive: true },
  { id: '3', name: '', isActive: true },
]

export default async function ReservasPage({ searchParams }: Props) {
  const { date: dateParam, highlight: highlightParam } = await searchParams
  const { club } = await getAdminContext(['OWNER', 'STAFF'])


  
  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const selectedDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : argTodayStr()
  const weekStart = getWeekStart(selectedDate)

  // BookingsProvider renders the header immediately (no DB data required).
  // The grid streams in via the Suspense below — only fires on the initial page load.
  // All subsequent week navigations are client-side (history.pushState), so
  // the Suspense never triggers again and the grid never remounts.
  return (
    <BookingsProvider initialSelectedDate={selectedDate} initialWeekStart={weekStart}>
      <BookingsHeader clubId={club.id} clubName={club.name} />
      
      <Suspense
        fallback={
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <BookingGridSkeleton courts={FALLBACK_COURTS} gridStart={8 * 60} gridEnd={22 * 60} />
          </div>
        }
      >
        <BookingsData
          clubId={club.id}
          weekStart={weekStart}
          highlightParam={highlightParam}
        />
      </Suspense>
    </BookingsProvider>
  )
}

// ── Async server component: fetches courts + bookings, renders once ───────────
// weekData is NOT computed here anymore — BookingsClient derives it client-side
// from the courts/rules passed via CourtsContext, enabling week navigation
// without any server involvement.
async function BookingsData({
  clubId,
  weekStart,
  highlightParam,
}: {
  clubId: string
  weekStart: string
  highlightParam?: string
}) {
  const weekEnd = addDays(weekStart, 6)

  const [{ courts: allCourts, clubRules }, conflicts, initialBookings] = await Promise.all([
    getCourtsByClubId(clubId),
    getConflictBookings(clubId),
    fetchBookingsAction(clubId, weekStart, weekEnd),
  ])

  return (
    <CourtsProvider
      allCourts={allCourts}
      clubRules={clubRules}
      conflicts={conflicts.map((c) => ({ id: c.id, dateStr: c.dateStr }))}
    >
      <BookingsClient
        initialBookings={initialBookings}
        initialWeekStart={weekStart}
        clubId={clubId}
        highlightBookingId={highlightParam}
      />
    </CourtsProvider>
  )
}
