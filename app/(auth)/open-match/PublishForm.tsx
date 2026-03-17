'use client'

import { useState, useTransition } from 'react'
import { createOpenMatch } from '@/actions/openMatch'

// ── TYPES ─────────────────────────────────────────────────────────────────

export interface UpcomingBooking {
  id: string
  clubName: string
  courtName: string
  dateLabel: string // e.g. "Lun 3 Feb"
  startTime: string
  durationMinutes: number
}

// ── LEVEL RANGE OPTIONS ────────────────────────────────────────────────────

const LEVEL_OPTIONS = [
  { value: '1.0–10.0', label: 'Todos los niveles' },
  { value: '1.0–3.0', label: 'Principiante (1.0–3.0)' },
  { value: '3.0–5.0', label: 'Intermedio (3.0–5.0)' },
  { value: '5.0–7.0', label: 'Avanzado (5.0–7.0)' },
  { value: '7.0–10.0', label: 'Competitivo (7.0–10.0)' },
]

// ── COMPONENT ─────────────────────────────────────────────────────────────

export default function PublishForm({ bookings }: { bookings: UpcomingBooking[] }) {
  const [open, setOpen] = useState(false)
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? '')
  const [requiredLevel, setRequiredLevel] = useState('1.0–10.0')
  const [spots, setSpots] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (bookings.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 text-center">
        <p className="text-sm text-muted">No tenés reservas próximas para publicar.</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-accent">¡Turno publicado!</p>
        <p className="text-xs text-muted mt-1">Ya aparece en el feed de turnos abiertos.</p>
      </div>
    )
  }

  function handleSubmit() {
    if (!bookingId) return
    setError(null)
    startTransition(async () => {
      const result = await createOpenMatch({ bookingId, requiredLevel, spotsAvailable: spots })
      if (!result.success) setError(result.error)
      else {
        setSuccess(true)
        setOpen(false)
      }
    })
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors"
      >
        <span className="text-sm font-semibold text-text">Publicar turno abierto</span>
        <span className="text-accent text-lg">{open ? '−' : '+'}</span>
      </button>

      {/* Form */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {/* Booking select */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
              Reserva
            </label>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.clubName} · {b.startTime} · {b.dateLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Required level */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
              Nivel requerido
            </label>
            <select
              value={requiredLevel}
              onChange={(e) => setRequiredLevel(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Spots */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
              Cupos disponibles
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setSpots(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    spots === n
                      ? 'bg-accent text-accent-text border-accent'
                      : 'bg-surface text-muted border-border hover:border-accent/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending || !bookingId}
            className="w-full py-2.5 bg-accent text-accent-text text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-accent-dark transition-colors"
          >
            {isPending ? 'Publicando…' : 'Publicar turno'}
          </button>
        </div>
      )}
    </div>
  )
}
