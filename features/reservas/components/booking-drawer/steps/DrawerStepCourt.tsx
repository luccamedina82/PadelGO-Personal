'use client'

import { calcBookingPrice, formatPrice } from '@/lib/availability'
import { computeEndTime } from '../../floating-booking-form/helpers/manualBookingWizard.helpers'
import { getAvailableDurationsForCourt } from '../../floating-booking-form/helpers/bookingCalcUtils'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'

interface DrawerStepCourtProps {
  startTime: string
  duration: number
  courts: CourtColumn[]
  courtSlots: FloatingFormCourtSlots[]
  onSelect: (courtId: string) => void
}

function fmtDur(d: number) {
  return d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}min`
}

export default function DrawerStepCourt({ startTime, duration, courts, courtSlots, onSelect }: DrawerStepCourtProps) {
  const endTime = startTime && duration > 0 ? computeEndTime(startTime, duration) : null

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-150">
      {/* Resumen del turno */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl border border-border">
        <span className="text-[10px] font-bold text-green-500">✓</span>
        <span className="text-[13px] text-text font-medium">
          {startTime}
          {endTime ? ` → ${endTime}` : ''}
          {' · '}
          {fmtDur(duration)}
        </span>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Elegí una cancha</p>

      <div className="flex flex-col gap-2">
        {courts.map((court) => {
          const available = getAvailableDurationsForCourt(startTime, court.id, courtSlots, [duration]).length > 0
          const slot = courtSlots.find((cs) => cs.courtId === court.id)?.slots.find((s) => s.time === startTime)
          const price = slot && available ? calcBookingPrice(slot.pricePerHour, duration) : 0

          return (
            <button
              key={court.id}
              type="button"
              disabled={!available}
              onClick={() => onSelect(court.id)}
              className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all active:scale-[.99] ${
                available
                  ? 'border-border bg-surface hover:border-accent/50 hover:bg-accent/5 cursor-pointer group'
                  : 'border-border/50 bg-surface/50 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${available ? 'bg-green-500' : 'bg-muted/40'}`} />
                <span className={`text-[14px] font-bold ${available ? 'text-text group-hover:text-accent' : 'text-muted'} transition-colors`}>
                  {court.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {price > 0 && (
                  <span className="text-[13px] font-semibold text-muted">{formatPrice(price)}</span>
                )}
                {available && (
                  <svg className="text-muted group-hover:text-accent transition-colors" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {!available && (
                  <span className="text-[11px] text-muted/60">No disponible</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
