'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { fetchConflictsAction } from '@/features/reservas/actions/conflicts'
import { cancelBooking } from '@/features/reservas/actions/bookings'
import type { ConflictBooking, CancelledBooking } from '@/features/reservas/actions/conflicts'

type Tab = 'conflicts' | 'cancellations'

const CONFLICT_META: Record<
  ConflictBooking['conflictType'],
  { label: string; cls: string }
> = {
  MAINTENANCE:  { label: '🟠 Mantenimiento', cls: 'bg-orange-500/10 border-orange-500/30 text-orange-500' },
  ARCHIVED:     { label: '🔴 Eliminada',      cls: 'bg-red-500/10 border-red-500/30 text-red-500' },
  OUT_OF_HOURS: { label: '🟡 Fuera de horario', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-500' },
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onConflictResolved: () => void
}

export default function ResolutionCenter({ isOpen, onClose, onConflictResolved }: Props) {
  const [tab, setTab] = useState<Tab>('conflicts')
  const [conflicts, setConflicts] = useState<ConflictBooking[]>([])
  const [cancellations, setCancellations] = useState<CancelledBooking[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!isOpen || loaded) return
    startTransition(async () => {
      const res = await fetchConflictsAction()
      if (res.success && res.data) {
        setConflicts(res.data.conflicts)
        setCancellations(res.data.cancellations)
        setLoaded(true)
      } else if (!res.success) {
        setLoadError(res.error)
      }
    })
  }, [isOpen, loaded])

  function handleCancel(id: string) {
    setCancellingId(id)
    startTransition(async () => {
      const res = await cancelBooking(id)
      setCancellingId(null)
      if (res.success) {
        setConflicts((prev) => prev.filter((c) => c.id !== id))
        toast.success('Reserva cancelada', { position: 'bottom-right' })
        onConflictResolved()
      } else {
        toast.error(res.error, { position: 'bottom-right' })
      }
    })
  }

  if (!isOpen) return null

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-[11px] font-bold uppercase tracking-[1.5px] border-b-2 transition-colors cursor-pointer ${
      tab === t
        ? 'border-accent text-accent'
        : 'border-transparent text-muted hover:text-text'
    }`

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-bg border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-display text-[16px] tracking-[2.5px] text-text uppercase">
              Centro de Resolución
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              {conflicts.length} conflicto{conflicts.length !== 1 ? 's' : ''} activo{conflicts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl border border-border text-muted flex items-center justify-center hover:text-text hover:border-border-hover transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 shrink-0">
          <button type="button" className={tabCls('conflicts')} onClick={() => setTab('conflicts')}>
            Conflictos {loaded && `(${conflicts.length})`}
          </button>
          <button type="button" className={tabCls('cancellations')} onClick={() => setTab('cancellations')}>
            Canceladas
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 [scrollbar-width:thin]">
          {!loaded && !loadError && (
            <div className="flex items-center justify-center h-32 text-muted text-sm">
              Cargando…
            </div>
          )}

          {loadError && (
            <p className="text-sm text-red-400 text-center py-8">{loadError}</p>
          )}

          {loaded && tab === 'conflicts' && (
            conflicts.length === 0 ? (
              <p className="text-sm text-muted/60 text-center py-12">
                Sin conflictos activos. Todo en orden.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {conflicts.map((c) => {
                  const meta = CONFLICT_META[c.conflictType]
                  const endMin = timeToMinutes(c.startTime) + c.durationMinutes
                  const endStr = minutesToTime(endMin)
                  return (
                    <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-text truncate">{c.playerName}</p>
                          <p className="text-[11px] text-muted">{c.courtName}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted font-mono">
                        <span>{formatDateStr(c.dateStr)}</span>
                        <span className="w-px h-3 bg-border" />
                        <span>{c.startTime} – {endStr}</span>
                        <span className="w-px h-3 bg-border" />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-surface ${
                          c.status === 'CONFIRMED' ? 'text-green-500' : 'text-amber-500'
                        }`}>{c.status === 'CONFIRMED' ? 'Confirmada' : 'Pendiente'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={cancellingId === c.id}
                          onClick={() => handleCancel(c.id)}
                          className="flex-1 py-[7px] rounded-lg border border-red-400/30 text-red-400 text-[11px] font-bold
                                     hover:bg-red-400/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {cancellingId === c.id ? 'Cancelando…' : 'Cancelar Turno'}
                        </button>
                        <a
                          href={`/admin/reservas?date=${c.dateStr}`}
                          className="flex-1 py-[7px] rounded-lg border border-border text-muted text-[11px] font-bold text-center
                                     hover:border-border-hover hover:text-text transition-colors"
                          onClick={onClose}
                        >
                          Reubicar
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {loaded && tab === 'cancellations' && (
            cancellations.length === 0 ? (
              <p className="text-sm text-muted/60 text-center py-12">Sin cancelaciones recientes.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {cancellations.map((c) => {
                  const endMin = timeToMinutes(c.startTime) + c.durationMinutes
                  return (
                    <div key={c.id} className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-text truncate">{c.playerName}</p>
                        <p className="text-[11px] text-muted">
                          {c.courtName} · {formatDateStr(c.dateStr)} · {c.startTime}–{minutesToTime(endMin)}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted/60 shrink-0">
                        {c.cancelledAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}

// ── Inline helpers ────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`
}

function formatDateStr(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}
