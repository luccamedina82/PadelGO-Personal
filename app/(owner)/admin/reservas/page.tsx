import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { argTodayStr } from '@/lib/date'
import { unstable_cache } from 'next/cache'
import ReservasShell from './ReservasShell'
import PrintButton from '@/components/ui/PrintButton'
import {
  cancelBooking,
  confirmBooking,
  updatePaymentStatus,
  updateBooking,
  updateBookingPlayers,
  searchPlayers,
} from '@/actions/owner/bookings'
import type { BookingBlock, CourtColumn } from '@/components/booking/BookingGrid'
import type { WeeklyBookingBlock } from '@/components/booking/WeeklyBookingGrid'

interface Props {
  searchParams: Promise<{ date?: string; new?: string; view?: 'day' | 'week' }>
}

function todayStr() {
  return argTodayStr()
}

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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

function getReservasData(
  clubId: string,
  dayOfWeek: number,
  viewMode: 'day' | 'week',
  selectedDate: string,
  weekStart: string,
  weekEnd: string
) {
  return unstable_cache(
    async () => {
      const courts = await prisma.court.findMany({
        where: { clubId, isActive: true },
        select: {
          id: true,
          name: true,
          availabilities: {
            where: { dayOfWeek, isActive: true },
            select: { openTime: true, closeTime: true },
          },
        },
        orderBy: { name: 'asc' },
      })

      const dayStart = new Date(`${selectedDate}T00:00:00.000Z`)
      const dayEnd = new Date(`${selectedDate}T23:59:59.999Z`)
      const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`)
      const weekEndDate = new Date(`${weekEnd}T23:59:59.999Z`)

      const rawBookings = await prisma.booking.findMany({
        where: {
          clubId,
          date: viewMode === 'week' ? { gte: weekStartDate, lte: weekEndDate } : { gte: dayStart, lte: dayEnd },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: {
          id: true,
          courtId: true,
          date: true,
          startTime: true,
          durationMinutes: true,
          status: true,
          source: true,
          totalPrice: true,
          paymentStatus: true,
          manualName: true,
          manualPhone: true,
          recurringBookingId: true,
          playerIds: true,
          paidPlayerIds: true,
          user: { select: { name: true } },
        },
      })

      return { courts, rawBookings }
    },
    [`admin-reservas-${clubId}-${selectedDate}-${viewMode}-${weekStart}-${weekEnd}-${dayOfWeek}`],
    {
      tags: [`club-${clubId}`],
      revalidate: 5,
    }
  )()
}

export default async function ReservasPage({ searchParams }: Props) {
  const { date: dateParam, new: newBookingId, view: viewParam } = await searchParams
  const session = await requireRole(['OWNER', 'STAFF'])
  const viewMode = viewParam === 'week' ? 'week' : 'day'

  const club =
    session.role === 'STAFF'
      ? await prisma.club.findUnique({
          where: { id: session.staffClubId ?? '' },
          select: { id: true, name: true },
        })
      : await prisma.club.findFirst({
          where: { ownerId: session.userId },
          select: { id: true, name: true },
        })

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const selectedDate = dateParam ?? todayStr()
  const today = todayStr()
  const dateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dayOfWeek = dateObj.getUTCDay()

  // Week view: calculate week start (Monday) and end (Sunday)
  const weekStart = getMonday(selectedDate)
  const weekDates = getWeekDates(weekStart)
  const weekEnd = weekDates[6]

  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const navDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayDate)
    d.setUTCDate(d.getUTCDate() + i - 2)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })

  const { courts, rawBookings: rawBookingsCached } = await getReservasData(
    club.id,
    dayOfWeek,
    viewMode,
    selectedDate,
    weekStart,
    weekEnd
  )

  let gridStart = 8 * 60
  let gridEnd = 23 * 60

  const openTimes: number[] = []
  const closeTimes: number[] = []
  for (const court of courts) {
    for (const avail of court.availabilities) {
      const [oh, om] = avail.openTime.split(':').map(Number)
      const [ch, cm] = avail.closeTime.split(':').map(Number)
      openTimes.push((oh ?? 8) * 60 + (om ?? 0))
      closeTimes.push((ch ?? 23) * 60 + (cm ?? 0))
    }
  }
  if (openTimes.length > 0) gridStart = Math.min(...openTimes)
  if (closeTimes.length > 0) gridEnd = Math.max(...closeTimes)
  gridStart = Math.floor(gridStart / 30) * 30
  gridEnd = Math.ceil(gridEnd / 30) * 30

  const rawBookings = rawBookingsCached.map((booking) => ({
    ...booking,
    date: new Date(booking.date),
  }))

  // Resolve player names for all bookings in one query
  const allPlayerIds = [...new Set(rawBookings.flatMap((b) => b.playerIds))]
  const playerList =
    allPlayerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allPlayerIds } },
          select: { id: true, name: true },
        })
      : []
  const playerMap = new Map(playerList.map((p) => [p.id, p.name]))

  // Helper to format date from Date object
  function formatDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const bookingBlocks: BookingBlock[] = rawBookings.map((b) => ({
    id: b.id,
    courtId: b.courtId,
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    status: b.status,
    source: b.source,
    displayName: b.source === 'BLOCK' ? (b.manualName ?? 'Bloqueo') : (b.manualName ?? b.user.name),
    totalPrice: b.totalPrice,
    paymentStatus: b.paymentStatus,
    manualPhone: b.manualPhone,
    recurringBookingId: b.recurringBookingId,
    playerDetails: b.playerIds.map((id) => ({ id, name: playerMap.get(id) ?? 'Jugador' })),
    paidPlayerIds: b.paidPlayerIds,
    date: formatDateStr(b.date),
  }))

  // For week view, create weekly booking blocks
  const weeklyBookingBlocks: WeeklyBookingBlock[] = rawBookings.map((b) => ({
    id: b.id,
    courtId: b.courtId,
    date: formatDateStr(b.date),
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    status: b.status,
    source: b.source,
    displayName: b.source === 'BLOCK' ? (b.manualName ?? 'Bloqueo') : (b.manualName ?? b.user.name),
    totalPrice: b.totalPrice,
    paymentStatus: b.paymentStatus,
    recurringBookingId: b.recurringBookingId,
  }))

  const courtColumns: CourtColumn[] = courts.map((c) => ({
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

  const activeBookings = bookingBlocks.filter((b) => b.status !== 'CANCELLED')

  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border print:static print:border-0">
        {/* Title row */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl tracking-widest text-text capitalize leading-none print:text-xl">
              {viewMode === 'week' ? weekLabel : dateLabel}
            </h1>
            <p className="text-xs text-muted mt-1">{club.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden print:hidden">
              <Link
                href={`/admin/reservas?date=${selectedDate}&view=day`}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === 'day'
                    ? 'bg-accent text-accent-text'
                    : 'text-muted hover:text-text'
                }`}
              >
                Día
              </Link>
              <Link
                href={`/admin/reservas?date=${selectedDate}&view=week`}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === 'week'
                    ? 'bg-accent text-accent-text'
                    : 'text-muted hover:text-text'
                }`}
              >
                Semana
              </Link>
            </div>
            <Link
              href={`/admin/reservas/nueva?date=${selectedDate}&view=${viewMode}`}
              prefetch
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-text
                         text-xs font-bold rounded-xl hover:bg-accent-dark transition-colors shadow-sm print:hidden"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nueva
            </Link>
          </div>
        </div>

        {/* Date navigation strip (only in day view) */}
        {viewMode === 'day' && (
          <div className="overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
            <div className="flex gap-1.5">
              {navDates.map((d) => {
                const dObj = new Date(`${d}T00:00:00.000Z`)
                const dow = DOW_LABELS[dObj.getUTCDay()]
                const day = dObj.getUTCDate()
                const isToday = d === today
                const isSelected = d === selectedDate
                return (
                  <Link
                    key={d}
                    href={`/admin/reservas?date=${d}&view=day`}
                    className={`shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl
                                text-xs transition-colors min-w-[44px]
                                ${
                                  isSelected
                                    ? 'bg-accent text-accent-text font-bold'
                                    : isToday
                                      ? 'bg-accent/10 text-accent font-semibold border border-accent/30'
                                      : 'bg-card border border-border text-muted hover:text-text hover:border-border-hover'
                                }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider leading-none mb-0.5">
                      {dow}
                    </span>
                    <span className="text-base font-bold leading-tight">{day}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Week navigation (only in week view) */}
        {viewMode === 'week' && (
          <div className="px-5 pb-3 flex items-center gap-2 print:hidden">
            <Link
              href={`/admin/reservas?date=${(() => {
                const d = new Date(`${weekStart}T00:00:00.000Z`)
                d.setUTCDate(d.getUTCDate() - 7)
                return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
              })()}&view=week`}
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
              href={`/admin/reservas?date=${(() => {
                const d = new Date(`${weekStart}T00:00:00.000Z`)
                d.setUTCDate(d.getUTCDate() + 7)
                return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
              })()}&view=week`}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted hover:text-text hover:border-border-hover transition-colors"
            >
              Siguiente →
            </Link>
          </div>
        )}

        {/* Legend + booking count */}
        <div className="px-5 py-2.5 flex items-center gap-5 border-t border-border/60 print:hidden">
          {[
            { label: 'Online', cssVar: 'var(--booking-online-bar)' },
            { label: 'Manual', cssVar: 'var(--booking-manual-bar)' },
            { label: 'Bloqueo', cssVar: 'var(--booking-block-bar)' },
            { label: 'Turno Fijo', cssVar: 'var(--booking-recurring-bar)' },
          ].map(({ label, cssVar }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  background: `color-mix(in srgb, ${cssVar} 18%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${cssVar} 45%, transparent)`,
                  borderLeft: `2px solid ${cssVar}`,
                }}
              />
              <span className="text-[10px] text-muted">{label}</span>
            </div>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {/* Print button */}
            <PrintButton />
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full
                         bg-tag text-tag-text border border-tag-border"
            >
              {activeBookings.length} {activeBookings.length === 1 ? 'reserva' : 'reservas'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 print:overflow-visible print:h-auto">
        {courtColumns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <span className="text-3xl opacity-30">🎾</span>
            <p className="text-sm text-muted">No hay canchas activas para este día.</p>
          </div>
        ) : viewMode === 'week' ? (
          <ReservasShell
            courts={courtColumns}
            bookings={bookingBlocks}
            weeklyBookings={weeklyBookingBlocks}
            date={selectedDate}
            weekStart={weekStart}
            gridStart={gridStart}
            gridEnd={gridEnd}
            cancelBookingAction={cancelBooking}
            confirmBookingAction={confirmBooking}
            updatePaymentStatusAction={updatePaymentStatus}
            updateBookingAction={updateBooking}
            updatePlayersAction={updateBookingPlayers}
            searchPlayersAction={searchPlayers}
            highlightBookingId={newBookingId}
            viewMode="week"
          />
        ) : (
          <ReservasShell
            courts={courtColumns}
            bookings={bookingBlocks}
            date={selectedDate}
            gridStart={gridStart}
            gridEnd={gridEnd}
            cancelBookingAction={cancelBooking}
            confirmBookingAction={confirmBooking}
            updatePaymentStatusAction={updatePaymentStatus}
            updateBookingAction={updateBooking}
            updatePlayersAction={updateBookingPlayers}
            searchPlayersAction={searchPlayers}
            highlightBookingId={newBookingId}
            viewMode="day"
          />
        )}
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block fixed top-0 left-0 right-0 bg-white p-4 border-b">
        <h1 className="text-lg font-bold">{viewMode === 'week' ? weekLabel : dateLabel}</h1>
        <p className="text-sm text-gray-600">{club.name}</p>
      </div>
    </div>
  )
}
