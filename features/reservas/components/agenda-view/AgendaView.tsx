'use client'

import { useMemo, useState, useEffect } from 'react'
import type { BookingBlock, CourtColumn } from '../booking-grid/types/bookingGrid.types'
import { formatPrice } from '@/lib/availability'
import { useBookingMutations } from '@/features/reservas/hooks/useBookings'
import AgendaCard from './AgendaCard'
import CourtStatusPanel from './CourtStatusPanel'

function getNowMinutesArg(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return h * 60 + m
}

type FilterKey = 'all' | 'unpaid'

interface AgendaViewProps {
  bookings: BookingBlock[]
  courts: CourtColumn[]
  clubId: string
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  alert,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  alert?: boolean
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p
        className={`font-display text-2xl font-bold tabular-nums leading-none ${
          accent ? 'text-accent' : alert ? 'text-orange-400' : 'text-text'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  )
}

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
        active
          ? 'bg-accent text-accent-text border-accent'
          : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
      }`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ label, live, dim }: { label: string; live?: boolean; dim?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {live && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
      )}
      <span
        className={`text-[11px] font-bold tracking-widest uppercase ${
          dim ? 'text-sub' : 'text-muted'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AgendaView({ bookings, courts, clubId }: AgendaViewProps) {
  const [nowMinutes, setNowMinutes] = useState<number>(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const { updatePayment } = useBookingMutations(clubId)

  // Hydration-safe: set real time only on client
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMinutes(getNowMinutesArg())
    const id = setInterval(() => setNowMinutes(getNowMinutesArg()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Filtered bookings (exclude BLOCK, apply search/filter)
  const relevantBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.source === 'BLOCK') return false
        if (filter === 'unpaid' && b.paymentStatus !== 'UNPAID') return false
        if (search) {
          const q = search.toLowerCase()
          if (!b.displayName?.toLowerCase().includes(q)) return false
        }
        return true
      }),
    [bookings, search, filter]
  )

  // Group into EN JUEGO / PRÓXIMOS / FINALIZADOS
  const { active, upcoming, finished } = useMemo(() => {
    const byTime = (a: BookingBlock, b: BookingBlock) => a.startTime.localeCompare(b.startTime)
    const active: BookingBlock[] = []
    const upcoming: BookingBlock[] = []
    const finished: BookingBlock[] = []
    for (const b of relevantBookings) {
      const [h, m] = b.startTime.split(':').map(Number)
      const start = (h ?? 0) * 60 + (m ?? 0)
      const end = start + b.durationMinutes
      if (start <= nowMinutes && end > nowMinutes) active.push(b)
      else if (start > nowMinutes) upcoming.push(b)
      else finished.push(b)
    }
    return {
      active: active.sort(byTime),
      upcoming: upcoming.sort(byTime),
      finished: finished.sort(byTime),
    }
  }, [relevantBookings, nowMinutes])

  // Stats derived from ALL bookings (not filtered)
  const { occupiedCourtIds, totalBookings, ingresos, porCobrar } = useMemo(() => {
    const nonBlock = bookings.filter((b) => b.source !== 'BLOCK')
    const occupiedCourtIds = new Set<string>()
    for (const b of bookings) {
      const [h, m] = b.startTime.split(':').map(Number)
      const start = (h ?? 0) * 60 + (m ?? 0)
      if (start <= nowMinutes && start + b.durationMinutes > nowMinutes) {
        occupiedCourtIds.add(b.courtId)
      }
    }
    return {
      occupiedCourtIds,
      totalBookings: nonBlock.length,
      ingresos: nonBlock
        .filter((b) => b.paymentStatus === 'PAID')
        .reduce((s, b) => s + b.totalPrice, 0),
      porCobrar: nonBlock
        .filter((b) => b.paymentStatus === 'UNPAID')
        .reduce((s, b) => s + b.totalPrice, 0),
    }
  }, [bookings, nowMinutes])

  const courtName = (id: string) => courts.find((c) => c.id === id)?.name ?? 'Cancha'
  const payingId = updatePayment.isPending ? updatePayment.variables?.id : undefined

  return (
    <div className="flex h-full overflow-hidden gap-4 p-4">

      {/* ── Left: stats + filter + agenda list ──────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden">

        {/* Stat cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
          <StatCard label="Reservas hoy" value={String(totalBookings)} />
          <StatCard
            label="Canchas libres ahora"
            value={String(courts.length - occupiedCourtIds.size)}
            sub={`de ${courts.length} totales`}
          />
          <StatCard label="Ingresos hoy" value={formatPrice(ingresos)} accent />
          <StatCard label="Por cobrar hoy" value={formatPrice(porCobrar)} alert={porCobrar > 0} />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
            Todas
          </FilterPill>
          <FilterPill active={filter === 'unpaid'} onClick={() => setFilter('unpaid')}>
            Pendientes de pago
          </FilterPill>
        </div>

        {/* Agenda list */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
          {active.length > 0 && (
            <section>
              <SectionLabel label="En juego (ahora)" live />
              <div className="space-y-2">
                {active.map((b) => (
                  <AgendaCard
                    key={b.id}
                    booking={b}
                    courtName={courtName(b.courtId)}
                    onCobrar={() => updatePayment.mutate({ id: b.id, status: 'PAID' })}
                    isPaying={payingId === b.id}
                  />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <SectionLabel label="Próximos" />
              <div className="space-y-2">
                {upcoming.map((b) => (
                  <AgendaCard
                    key={b.id}
                    booking={b}
                    courtName={courtName(b.courtId)}
                    onCobrar={() => updatePayment.mutate({ id: b.id, status: 'PAID' })}
                    isPaying={payingId === b.id}
                  />
                ))}
              </div>
            </section>
          )}

          {finished.length > 0 && (
            <section>
              <SectionLabel label="Finalizados" dim />
              <div className="space-y-2 opacity-60">
                {finished.map((b) => (
                  <AgendaCard
                    key={b.id}
                    booking={b}
                    courtName={courtName(b.courtId)}
                    onCobrar={() => updatePayment.mutate({ id: b.id, status: 'PAID' })}
                    isPaying={payingId === b.id}
                  />
                ))}
              </div>
            </section>
          )}

          {relevantBookings.length === 0 && (
            <p className="text-center text-muted text-sm py-16">
              {search || filter !== 'all'
                ? 'Sin resultados para ese filtro'
                : 'No hay reservas para este día'}
            </p>
          )}
        </div>
      </div>

      {/* ── Right: court status panel ────────────────────────────────────── */}
      <CourtStatusPanel
        courts={courts}
        occupiedCourtIds={occupiedCourtIds}
        bookings={bookings}
        nowMinutes={nowMinutes}
      />
    </div>
  )
}
