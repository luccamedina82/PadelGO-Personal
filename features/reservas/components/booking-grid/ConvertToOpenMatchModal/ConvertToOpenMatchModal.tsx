'use client'

import { useState } from 'react'
import { convertBookingToOpenMatch } from '@/features/reservas/actions/bookings'

interface ConvertToOpenMatchModalProps {
  bookingId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ConvertToOpenMatchModal({
  bookingId,
  onClose,
  onSuccess,
}: ConvertToOpenMatchModalProps) {
  const [requiredLevel, setRequiredLevel] = useState('3.0–5.0')
  const [spotsAvailable, setSpotsAvailable] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConvert() {
    setLoading(true)
    setError(null)

    try {
      const result = await convertBookingToOpenMatch({
        bookingId,
        requiredLevel,
        spotsAvailable,
      })

      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || 'Error al convertir la reserva')
      }
    } catch (err) {
      setError('Error inesperado')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-border-hover p-5 shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text">Convertir a Partido Abierto</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-card hover:bg-card-hover text-muted hover:text-text transition-colors text-base leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 mb-5">
          <div>
            <label className="text-xs text-muted block mb-1">Nivel requerido</label>
            <select
              value={requiredLevel}
              onChange={(e) => setRequiredLevel(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            >
              <option value="1.0–2.0">Iniciante (1.0–2.0)</option>
              <option value="2.0–3.0">Recreativo (2.0–3.0)</option>
              <option value="3.0–4.0">Intermedio (3.0–4.0)</option>
              <option value="3.0–5.0">Intermedio+ (3.0–5.0)</option>
              <option value="4.0–5.0">Avanzado (4.0–5.0)</option>
              <option value="5.0+">Profesional (5.0+)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Cupos disponibles</label>
            <select
              value={spotsAvailable}
              onChange={(e) => setSpotsAvailable(parseInt(e.target.value))}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            >
              <option value={1}>1 jugador</option>
              <option value={2}>2 jugadores</option>
              <option value={3}>3 jugadores</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-medium hover:text-text transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text text-sm font-semibold hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {loading ? '...' : 'Convertir'}
          </button>
        </div>
      </div>
    </div>
  )
}
