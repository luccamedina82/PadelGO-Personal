'use client'

import { getVisibleTimeSlotsForDate } from '../../floating-booking-form/helpers/bookingCalcUtils'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'

interface DrawerStepDateTimeProps {
  date: string
  bookingMode: 'RESERVA' | 'BLOQUEO'
  selectedDuration: number
  selectedTime: string
  globalDurations: number[]
  courtSlots: FloatingFormCourtSlots[]
  isLoading: boolean
  onDurationChange: (d: number) => void
  onTimeSelect: (t: string) => void
}

function fmtDur(d: number) {
  return d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}min`
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

export default function DrawerStepDateTime({
  date, bookingMode, selectedDuration, selectedTime, globalDurations, courtSlots, isLoading, onDurationChange, onTimeSelect,
}: DrawerStepDateTimeProps) {
  // Duraciones disponibles — fallback a [60, 90] si aún no cargaron
  const durations = globalDurations.length > 0 ? globalDurations : [60, 90]

  // Para BLOQUEO: mostrar todos los slots con al menos 30min disponibles
  // Para RESERVA: filtrar por la duración seleccionada
  const availableTimes = bookingMode === 'BLOQUEO'
    ? getVisibleTimeSlotsForDate(courtSlots, [30])
    : getVisibleTimeSlotsForDate(courtSlots, [selectedDuration])
  
  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-150">
      {/* Fecha (solo lectura en este paso) */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl border border-border">
        <span className="text-[10px] font-bold text-green-500">✓</span>
        <span className="text-[13px] text-text font-medium capitalize">{fmtDate(date)}</span>
      </div>

      {/* Duración — solo para RESERVA */}
      {bookingMode !== 'BLOQUEO' && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Duración</p>
          <div className="flex gap-2">
            {durations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDurationChange(d)}
                className={`flex-1 py-2.5 rounded-xl border text-[13px] font-bold cursor-pointer transition-all active:scale-[.97] ${
                  selectedDuration === d
                    ? 'border-accent bg-accent/10 text-accent shadow-[0_0_0_1px_inset] shadow-accent/20'
                    : 'border-border bg-surface text-text hover:border-border-hover hover:bg-card'
                }`}
              >
                {fmtDur(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hora de inicio */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
          {bookingMode === 'BLOQUEO' ? 'Hora de inicio del bloqueo' : 'Hora de inicio'}
          {!isLoading && availableTimes.length === 0 && (
            <span className="ml-2 normal-case font-normal text-muted/60">— Sin disponibilidad{bookingMode !== 'BLOQUEO' ? ` para ${fmtDur(selectedDuration)}` : ''}</span>
          )}
        </p>
        {isLoading ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-14 h-8 rounded-lg bg-surface animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {availableTimes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTimeSelect(t)}
                className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono font-semibold cursor-pointer transition-all active:scale-95 ${
                  selectedTime === t
                    ? 'border-accent bg-accent text-accent-text'
                    : 'border-border bg-surface text-muted hover:border-border-hover hover:text-text'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
