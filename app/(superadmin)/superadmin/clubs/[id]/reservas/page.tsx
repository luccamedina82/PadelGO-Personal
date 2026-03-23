import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import SuperadminBanner from '@/components/layout/SuperadminBanner'
import ReservasShell from '@/app/(owner)/admin/reservas/ReservasShell'
import type { BookingBlock, CourtColumn } from '@/components/booking/BookingGrid'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { argTodayStr } from '@/lib/date'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}

function todayStr() {
  return argTodayStr()
}

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default async function SuperadminClubReservasPage({ params, searchParams }: Props) {
  await requireSuperAdmin()

  const { id } = await params
  const { date: dateParam } = await searchParams

  const club = await prisma.club.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      zone: true,
      isActive: true,
      _count: { select: { courts: true } },
    },
  })

  if (!club) notFound()

  const selectedDate = dateParam ?? todayStr()
  const dateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dayOfWeek = dateObj.getUTCDay()

  const today = todayStr()
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const navDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayDate)
    d.setUTCDate(d.getUTCDate() + i - 2)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })

  const courts = await prisma.court.findMany({
    where: { clubId: id, isActive: true },
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

  const rawBookings = await prisma.booking.findMany({
    where: {
      clubId: id,
      date: dateObj,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      id: true,
      courtId: true,
      startTime: true,
      durationMinutes: true,
      status: true,
      source: true,
      totalPrice: true,
      paymentStatus: true,
      manualName: true,
      user: { select: { name: true } },
    },
  })

  const bookingBlocks: BookingBlock[] = rawBookings.map((b) => ({
    id: b.id,
    clubId: id,
    courtId: b.courtId,
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    status: b.status,
    source: b.source,
    displayName: b.source === 'BLOCK' ? (b.manualName ?? 'Bloqueo') : (b.manualName ?? b.user.name),
    totalPrice: b.totalPrice,
    paymentStatus: b.paymentStatus,
    date: selectedDate,
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0810' }}>
      <SuperadminBanner
        clubId={id}
        clubName={club.name}
        zone={club.zone}
        courtCount={club._count.courts}
        isActive={club.isActive}
      />

      {/* Sub-header */}
      <div className="sticky top-[45px] z-20 bg-surface border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-text capitalize">{dateLabel}</h1>
            <p className="text-xs text-muted">{club.name} · Modo soporte</p>
          </div>
        </div>
        <div className="overflow-x-auto px-4 pb-2">
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
                  href={`/superadmin/clubs/${id}/reservas?date=${d}`}
                  className={`shrink-0 flex flex-col items-center px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'font-semibold'
                      : isToday
                        ? 'border font-medium'
                        : 'bg-card border border-border text-muted hover:text-text'
                  }`}
                  style={
                    isSelected
                      ? { background: '#a855f7', color: 'white' }
                      : isToday
                        ? {
                            borderColor: 'rgba(168,85,247,0.4)',
                            color: '#a855f7',
                            background: 'rgba(168,85,247,0.08)',
                          }
                        : {}
                  }
                >
                  <span className="text-[9px] uppercase">{dow}</span>
                  <span className="text-sm font-bold leading-tight">{day}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex gap-4 border-b border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-blue-400/40" />
          <span className="text-[10px] text-muted">Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-orange-400/40" />
          <span className="text-[10px] text-muted">Manual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-border/50" />
          <span className="text-[10px] text-muted">Bloqueo</span>
        </div>
        <div className="ml-auto text-[10px] text-muted font-mono">
          {bookingBlocks.length} reserva{bookingBlocks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {courtColumns.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            No hay canchas activas para este día.
          </div>
        ) : (
          <ReservasShell
            courts={courtColumns}
            bookings={bookingBlocks}
            date={selectedDate}
            gridStart={gridStart}
            gridEnd={gridEnd}
          />
        )}
      </div>
    </div>
  )
}
