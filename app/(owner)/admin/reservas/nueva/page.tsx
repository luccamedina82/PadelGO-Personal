import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import ManualBookingWizard from '@/components/booking/ManualBookingWizard'
import { createManualBooking } from '@/actions/owner/bookings'
import { calcAvailableSlots } from '@/lib/availability'
import Link from 'next/link'
import { argToday, argTodayStr } from '@/lib/date'

interface Props {
  searchParams: Promise<{ courtId?: string; date?: string; time?: string }>
}

function todayStr() {
  return argTodayStr()
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const SLOT_H = 48
const TIME_COL = 52

function minsToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export default async function NuevaReservaPage({ searchParams }: Props) {
  const { courtId: defaultCourtId, date: dateParam, time: defaultTime } = await searchParams
  const session = await requireRole(['OWNER', 'STAFF'])

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

  const today = todayStr()
  const selectedDate = dateParam ?? today
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const selectedDateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const dayOfWeek = selectedDateObj.getUTCDay()

  const dateLabel = selectedDateObj.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  // Date nav for backdrop (-2 to +11 from today)
  const navDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayDate)
    d.setDate(d.getDate() + i - 2)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // Fetch courts with all availabilities (needed for both wizard and backdrop)
  const courts = await prisma.court.findMany({
    where: { clubId: club.id, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      covered: true,
      availabilities: {
        where: { isActive: true },
        select: {
          dayOfWeek: true,
          openTime: true,
          closeTime: true,
          pricePerHour: true,
          isActive: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Compute gridStart/gridEnd for the backdrop (from selected date's DOW)
  let gridStart = 8 * 60
  let gridEnd = 23 * 60
  const openTimes: number[] = []
  const closeTimes: number[] = []
  for (const court of courts) {
    const avail = court.availabilities.find((a) => a.dayOfWeek === dayOfWeek)
    if (avail) {
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

  const totalSlots = (gridEnd - gridStart) / 30
  const gridH = totalSlots * SLOT_H

  // Active courts for the selected date's DOW (for backdrop columns)
  const activeCourts = courts.filter((c) => c.availabilities.some((a) => a.dayOfWeek === dayOfWeek))

  // Fetch bookings for the backdrop (selected date)
  const backdropBookings = await prisma.booking.findMany({
    where: {
      clubId: club.id,
      date: selectedDateObj,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      id: true,
      courtId: true,
      startTime: true,
      durationMinutes: true,
      status: true,
      source: true,
      manualName: true,
      user: { select: { name: true } },
    },
  })

  const backdropBlocks = backdropBookings.map((b) => ({
    id: b.id,
    courtId: b.courtId,
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    source: b.source,
    displayName: b.source === 'BLOCK' ? (b.manualName ?? 'Bloqueo') : (b.manualName ?? b.user.name),
  }))

  // ── Wizard data: 14-day slot computation ──────────────────────────────

  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(argToday())
    d.setUTCDate(d.getUTCDate() + i)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })

  const from = new Date(`${availableDates[0]}T00:00:00.000Z`)
  const to = new Date(`${availableDates[availableDates.length - 1]}T23:59:59.000Z`)

  const allBookings = await prisma.booking.findMany({
    where: {
      clubId: club.id,
      date: { gte: from, lte: to },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { courtId: true, date: true, startTime: true, durationMinutes: true, status: true },
  })

  type CourtSlotsEntry = {
    courtId: string
    slots: { time: string; available: boolean; durationOptions: number[]; pricePerHour: number }[]
  }

  const courtSlotsByDate: Record<string, CourtSlotsEntry[]> = {}

  for (const dateStr of availableDates) {
    const dObj = new Date(`${dateStr}T00:00:00.000Z`)
    const dow = dObj.getUTCDay()
    const dateSlots: CourtSlotsEntry[] = []

    for (const court of courts) {
      const avail = court.availabilities.find((a) => a.dayOfWeek === dow)
      if (!avail) {
        dateSlots.push({ courtId: court.id, slots: [] })
        continue
      }

      const courtBookings = allBookings.filter((b) => {
        const bd = b.date
        const bdStr = `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`
        return b.courtId === court.id && bdStr === dateStr
      })

      const slots = calcAvailableSlots(
        { openTime: avail.openTime, closeTime: avail.closeTime, pricePerHour: avail.pricePerHour },
        courtBookings,
        dObj
      )

      dateSlots.push({
        courtId: court.id,
        slots: slots.map((s) => ({
          time: s.time,
          available: s.available,
          durationOptions: s.durationOptions,
          pricePerHour: s.pricePerHour,
        })),
      })
    }
    courtSlotsByDate[dateStr] = dateSlots
  }

  const courtsForWizard = courts.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    covered: c.covered,
  }))

  return (
    <div className="h-screen bg-bg overflow-hidden relative">
      {/* ── BACKGROUND — full-width calendar backdrop ─────────────── */}
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {/* Dimmed header */}
        <div className="sticky top-0 z-10 bg-surface/70 border-b border-border backdrop-blur-sm">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4">
            <div className="opacity-50">
              <h1 className="font-display text-2xl tracking-widest text-text capitalize leading-none">
                {dateLabel}
              </h1>
              <p className="text-xs text-muted mt-1">{club.name}</p>
            </div>
            <Link
              href={`/admin/reservas?date=${selectedDate}`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border
                         text-xs font-semibold text-muted hover:text-text hover:border-border-hover transition-colors"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Cancelar
            </Link>
          </div>

          {/* Date nav (pointer-events-none) */}
          <div className="overflow-x-auto px-5 pb-3 opacity-40 pointer-events-none select-none">
            <div className="flex gap-1.5">
              {navDates.map((d) => {
                const dObj = new Date(`${d}T00:00:00.000Z`)
                const dow = DOW[dObj.getUTCDay()]
                const day = dObj.getUTCDate()
                const isSel = d === selectedDate
                return (
                  <div
                    key={d}
                    className={`shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl text-xs min-w-[44px]
                                ${isSel ? 'bg-accent text-accent-text font-bold' : 'bg-card border border-border text-muted'}`}
                  >
                    <span className="text-[9px] uppercase tracking-wider leading-none mb-0.5">
                      {dow}
                    </span>
                    <span className="text-base font-bold leading-tight">{day}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend (pointer-events-none) */}
          <div className="px-5 py-2.5 flex gap-4 border-t border-border/50 opacity-30 pointer-events-none">
            {[
              { label: 'Online', cssVar: 'var(--booking-online-bar)' },
              { label: 'Manual', cssVar: 'var(--booking-manual-bar)' },
              { label: 'Bloqueo', cssVar: 'var(--booking-block-bar)' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{
                    background: `color-mix(in srgb, ${l.cssVar} 18%, transparent)`,
                    borderLeft: `2px solid ${l.cssVar}`,
                  }}
                />
                <span className="text-[10px] text-muted">{l.label}</span>
              </div>
            ))}
            <div className="ml-auto text-[10px] text-muted font-mono">
              {backdropBlocks.length} reserva{backdropBlocks.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Simplified grid */}
        <div className="flex-1 overflow-auto pointer-events-none select-none opacity-20">
          <div style={{ minWidth: `${TIME_COL + activeCourts.length * 100}px` }}>
            {/* Court headers */}
            <div className="flex sticky top-0 z-10 bg-surface border-b-2 border-border">
              <div
                style={{ width: TIME_COL, minWidth: TIME_COL }}
                className="shrink-0 border-r border-border"
              />
              {activeCourts.map((c) => (
                <div
                  key={c.id}
                  className="flex-1 flex flex-col items-center justify-center py-2.5 border-l border-border"
                >
                  <p className="text-xs font-bold text-text">{c.name}</p>
                  <div className="mt-1 w-5 h-0.5 rounded-full bg-accent opacity-50" />
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div className="relative flex">
              {/* Time col */}
              <div
                style={{ width: TIME_COL, minWidth: TIME_COL, height: gridH }}
                className="shrink-0 relative border-r border-border bg-bg"
              >
                {Array.from({ length: totalSlots }, (_, i) => {
                  const mins = gridStart + i * 30
                  return (
                    <div
                      key={i}
                      className={`absolute left-0 right-0 flex items-start justify-end pr-2
                                  ${mins % 60 === 0 ? 'border-b border-border' : 'border-b border-border/40'}`}
                      style={{
                        top: i * SLOT_H,
                        height: SLOT_H,
                        background: mins % 60 === 0 ? 'var(--grid-row-alt)' : 'transparent',
                      }}
                    >
                      {mins % 60 === 0 && (
                        <span className="text-[10px] font-mono text-muted mt-1.5">
                          {minsToTime(mins)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Court cols */}
              {activeCourts.map((c) => {
                const cb = backdropBlocks.filter((b) => b.courtId === c.id)
                return (
                  <div
                    key={c.id}
                    className="flex-1 relative border-l border-border"
                    style={{ height: gridH }}
                  >
                    {Array.from({ length: totalSlots }, (_, i) => {
                      const mins = gridStart + i * 30
                      return (
                        <div
                          key={i}
                          className={`absolute left-0 right-0
                                      ${mins % 60 === 0 ? 'border-b border-border' : 'border-b border-border/40'}`}
                          style={{
                            top: i * SLOT_H,
                            height: SLOT_H,
                            background: mins % 60 === 0 ? 'var(--grid-row-alt)' : 'transparent',
                          }}
                        />
                      )
                    })}
                    {cb.map((b) => {
                      const [bh, bm] = b.startTime.split(':').map(Number)
                      const sm = (bh ?? 0) * 60 + (bm ?? 0)
                      const top = ((sm - gridStart) / 30) * SLOT_H
                      const h = (b.durationMinutes / 30) * SLOT_H - 3
                      const cls =
                        b.source === 'BLOCK'
                          ? 'booking-block-block'
                          : b.source === 'ONLINE'
                            ? 'booking-block-online'
                            : 'booking-block-manual'
                      return (
                        <div
                          key={b.id}
                          className={`booking-block ${cls}`}
                          style={{ top: top + 2, left: 5, right: 5, height: Math.max(h, 20) }}
                        >
                          <p className="text-[10px] font-bold truncate">{b.displayName}</p>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right fade edge */}
        <div
          className="absolute inset-y-0 right-0 w-[440px] pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent, var(--bg))' }}
        />
      </div>

      {/* ── OVERLAY — wizard panel ─────────────────────────────────── */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[420px] border-l border-border z-20 flex flex-col"
        style={{ boxShadow: '-12px 0 40px rgba(0,0,0,0.28)' }}
      >
        <ManualBookingWizard
          courts={courtsForWizard}
          courtSlotsByDate={courtSlotsByDate}
          availableDates={availableDates}
          clubId={club.id}
          createManualBookingAction={createManualBooking}
          defaultCourtId={defaultCourtId}
          defaultDate={selectedDate}
          defaultTime={defaultTime}
        />
      </div>
    </div>
  )
}
