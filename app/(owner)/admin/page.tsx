import { argToday, argTomorrow, argTodayStr } from '@/lib/date'
import Link from 'next/link'
import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import AdminAgendaClient from './AdminAgendaClient'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { Suspense } from 'react'

export default async function AdminDashboardPage() {
  const { session, club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return (
      <div className="p-8 text-center text-muted">
        No tenés ningún club asignado.{' '}
        {session.role === 'OWNER' && <span>Contactá a soporte para configurar tu club.</span>}
      </div>
    )
  }

  const today = argToday()
  const tomorrow = argTomorrow()
  const todayStr = argTodayStr()

  const [{ courts, clubRules }, todayBookings] = await Promise.all([
    getCourtsByClubId(club.id),
    getAdminBookingsByDate(club.id, today, tomorrow),
  ])

  // La paleta de duraciones del admin viene exclusivamente de la regla base (priority=0).
  // Las reglas de prioridad >0 solo restringen el booking online, no al admin.
  const now = new Date()
  const activeBaseRule = clubRules
    .filter((r) => r.priority === 0)
    .find((r) => {
      const fromOk = !r.activeFrom || r.activeFrom <= now
      const untilOk = !r.activeUntil || r.activeUntil >= now
      return fromOk && untilOk
    })
  const adminAllowedDurations = activeBaseRule?.allowedDurations.slice().sort((a, b) => a - b) ?? [60, 90, 120]

  const courtColumns: CourtColumn[] = courts.map((c) => ({
    id: c.id,
    name: c.name,
    isActive: true,
    allowedDurations: adminAllowedDurations,
  }))

  const todayDateObj = new Date(`${todayStr}T00:00:00.000Z`)
  const dateLabel = todayDateObj.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border">
        <div className="pl-5 pr-4 py-2.5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest leading-none mb-0.5">
              {club.name}
            </p>
            <h1 className="font-display text-2xl font-bold text-text capitalize leading-none">
              {dateLabel}
            </h1>
          </div>
          <Link
            href={`/admin/reservas?date=${todayStr}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-text text-sm font-bold rounded-xl hover:bg-accent-dark transition-colors shadow-sm shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva reserva
          </Link>
        </div>
      </div>

      {/* ── Agenda ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<p className="p-8 text-center text-muted text-sm">Cargando agenda...</p>}>
          <AdminAgendaClient
            initialBookings={todayBookings}
            courts={courtColumns}
            clubId={club.id}
            date={todayStr}
          />
        </Suspense>
      </div>
    </div>
  )
}
