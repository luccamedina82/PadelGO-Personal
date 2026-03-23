'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/availability'
import type { ActionResult } from '@/types'
import type { CreateRecurringBookingInput, RecurringConflict } from '@/actions/owner/recurring'

interface Court {
  id: string
  name: string
}

interface RecurringEntry {
  id: string
  courtId: string
  court: { name: string }
  playerName: string
  playerPhone: string | null
  dayOfWeek: number
  startTime: string
  durationMinutes: number
  pricePerSession: number
  startDate: Date
  isActive: boolean
  generatedBookings: { id: string }[]
}

interface TurnosFijosClientProps {
  clubId: string
  courts: Court[]
  recurring: RecurringEntry[]
  createAction: (
    input: CreateRecurringBookingInput
  ) => Promise<
    ActionResult<{ recurringId: string; bookingsCreated: number; conflicts: RecurringConflict[] }>
  >
  cancelAction: (id: string, clubId: string) => Promise<ActionResult>
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DURATION_LABELS: Record<number, string> = { 60: '1h', 90: '1h 30m', 120: '2h' }

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 23; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

export default function TurnosFijosClient({
  clubId,
  courts,
  recurring,
  createAction,
  cancelAction,
}: TurnosFijosClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [list, setList] = useState(recurring)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<RecurringConflict[]>([])

  // Sync list when server refreshes recurring prop
  useEffect(() => {
    setList(recurring)
  }, [recurring])

  // Form state
  const [courtId, setCourtId] = useState(courts[0]?.id ?? '')
  const [playerName, setPlayerName] = useState('')
  const [playerPhone, setPlayerPhone] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(1) // Lun default
  const [startTime, setStartTime] = useState('19:00')
  const [durationMinutes, setDurationMinutes] = useState(90)
  const [pricePerSession, setPricePerSession] = useState(700000) // $7000 default

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setConflicts([])
    startTransition(async () => {
      const result = await createAction({
        clubId,
        courtId,
        playerName,
        playerPhone: playerPhone || undefined,
        dayOfWeek,
        startTime,
        durationMinutes,
        pricePerSession,
      })
      if (result.success) {
        const created = result.data?.bookingsCreated ?? 0
        const newConflicts = result.data?.conflicts ?? []
        setConflicts(newConflicts)
        if (newConflicts.length > 0) {
          showToast(
            'success',
            `Turno fijo creado · ${created}/${created + newConflicts.length} turnos generados (${newConflicts.length} conflicto${newConflicts.length !== 1 ? 's' : ''})`
          )
        } else {
          showToast('success', `Turno fijo creado · ${created} turnos generados`)
        }
        setShowForm(false)
        setPlayerName('')
        setPlayerPhone('')
        // Set highlight before refresh so it applies when list updates
        const newId = result.data?.recurringId
        if (newId) {
          setHighlightId(newId)
          setTimeout(() => setHighlightId(null), 30_000)
        }
        router.refresh()
      } else {
        showToast('error', result.error)
      }
    })
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await cancelAction(id, clubId)
      if (result.success) {
        setList((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: false, generatedBookings: [] } : r))
        )
        showToast('success', 'Turno fijo cancelado')
      } else {
        showToast('error', result.error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-xl pointer-events-none ${
            toast.type === 'success'
              ? 'bg-green-400/10 border-green-400/30 text-green-400'
              : 'bg-red-400/10 border-red-400/30 text-red-400'
          }`}
        >
          {toast.type === 'success' ? '✓ ' : '✕ '}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-text">Turnos Fijos</h1>
          <p className="text-xs text-muted">Reservas semanales recurrentes</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 px-4 py-2 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6 pb-16">
        {/* Create form */}
        {showForm && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm text-text">Nuevo turno fijo</h2>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Court */}
                <div className="col-span-2">
                  <label className="text-xs text-muted block mb-1">Cancha</label>
                  <select
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
                  >
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Player name */}
                <div>
                  <label className="text-xs text-muted block mb-1">Nombre del jugador</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ej: Martín López"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                {/* Player phone */}
                <div>
                  <label className="text-xs text-muted block mb-1">Teléfono (opcional)</label>
                  <input
                    type="tel"
                    value={playerPhone}
                    onChange={(e) => setPlayerPhone(e.target.value)}
                    placeholder="+54 9 351 000 0000"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Day of week */}
                <div>
                  <label className="text-xs text-muted block mb-1">Día de la semana</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start time */}
                <div>
                  <label className="text-xs text-muted block mb-1">Horario</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text font-mono focus:outline-none focus:border-accent"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs text-muted block mb-1">Duración</label>
                  <div className="flex gap-2">
                    {[60, 90, 120].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDurationMinutes(d)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                          durationMinutes === d
                            ? 'bg-accent text-accent-text border-accent'
                            : 'bg-surface border-border text-muted hover:border-border-hover'
                        }`}
                      >
                        {DURATION_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="text-xs text-muted block mb-1">Precio por turno ($)</label>
                  <input
                    type="number"
                    value={Math.round(pricePerSession / 100)}
                    onChange={(e) =>
                      setPricePerSession(Math.round(parseFloat(e.target.value) * 100) || 0)
                    }
                    min="0"
                    step="100"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text font-mono focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
              >
                {isPending ? 'Creando...' : `Crear · próximas 8 semanas`}
              </button>
            </form>
          </div>
        )}

        {/* Conflict warnings */}
        {conflicts.length > 0 && (
          <div className="bg-yellow-400/8 border border-yellow-400/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-yellow-400 mb-2">
              ⚠ {conflicts.length} fecha{conflicts.length !== 1 ? 's' : ''} con conflicto — no se
              generaron esos turnos:
            </p>
            <div className="space-y-1.5">
              {conflicts.map((c) => {
                const dateLabel = new Date(`${c.date}T00:00:00.000Z`).toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })
                return (
                  <div key={c.date} className="flex items-center gap-2 text-xs text-yellow-300/80">
                    <span className="font-mono font-semibold capitalize">{dateLabel}</span>
                    <span className="text-yellow-400/50">·</span>
                    <span className="truncate">
                      ocupado por <span className="font-semibold">{c.existingName}</span> a las{' '}
                      <span className="font-mono">{c.existingTime}</span> ({c.existingDuration}min)
                    </span>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setConflicts([])}
              className="mt-2 text-[10px] text-yellow-400/60 hover:text-yellow-400 transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* List */}
        {list.length === 0 && !showForm ? (
          <div className="text-center py-16 text-muted text-sm">
            <p className="text-3xl mb-3">📅</p>
            <p>No hay turnos fijos registrados.</p>
            <p className="text-xs mt-1">Creá uno para bloquear un horario semanal recurrente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((r) => (
              <div
                key={r.id}
                className={`bg-card border rounded-xl overflow-hidden transition-opacity ${
                  r.isActive ? 'border-border' : 'border-border opacity-50'
                }${r.id === highlightId ? ' entry-highlighted' : ''}`}
              >
                <div className="px-4 py-3 flex items-start gap-3">
                  {/* Left: day badge */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
                      r.isActive ? 'bg-accent/15 text-accent' : 'bg-surface text-sub'
                    }`}
                  >
                    {DAYS[r.dayOfWeek]}
                  </div>

                  {/* Center: details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-text">{r.playerName}</span>
                      {!r.isActive && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-border text-sub">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted">
                      <span className="font-mono">{r.startTime}</span>
                      <span>{DURATION_LABELS[r.durationMinutes] ?? `${r.durationMinutes}m`}</span>
                      <span>{r.court.name}</span>
                      <span className="font-mono text-accent">
                        {formatPrice(r.pricePerSession)}
                      </span>
                    </div>
                    {r.playerPhone && <p className="text-xs text-sub mt-0.5">{r.playerPhone}</p>}
                    {r.isActive && (
                      <p className="text-xs text-sub mt-1">
                        {r.generatedBookings.length} turno
                        {r.generatedBookings.length !== 1 ? 's' : ''} próximo
                        {r.generatedBookings.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Right: cancel button */}
                  {r.isActive && (
                    <button
                      type="button"
                      onClick={() => handleCancel(r.id)}
                      disabled={isPending}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-sub border border-border rounded-lg hover:border-red-400/50 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
