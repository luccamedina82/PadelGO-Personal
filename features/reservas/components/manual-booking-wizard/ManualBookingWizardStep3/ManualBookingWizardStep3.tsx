import type { BookingType } from '../types/manualBookingWizard.types'
import { computeEndTime, formatDateFull } from '../helpers/manualBookingWizard.helpers'

interface ManualBookingWizardStep3Props {
  courtName: string
  date: string
  startTime: string
  duration: number
  bookingType: BookingType
  clientName: string
  blockReason: string
  isPending: boolean
  error: string | null
  onConfirm(): void
  onBack(): void
}

export default function ManualBookingWizardStep3({
  courtName,
  date,
  startTime,
  duration,
  bookingType,
  clientName,
  blockReason,
  isPending,
  error,
  onConfirm,
  onBack,
}: ManualBookingWizardStep3Props) {
  const endTime = computeEndTime(startTime, duration)
  const dateLabel = formatDateFull(date)

  const typeLabel =
    bookingType === 'PRESENCIAL' ? 'Presencial' : bookingType === 'TELEFONO' ? 'Teléfono' : 'Bloqueo'

  const rows = [
    { label: 'Cancha', value: courtName, mono: false },
    { label: 'Fecha', value: dateLabel, mono: false },
    { label: 'Horario', value: `${startTime} → ${endTime}`, mono: true },
    { label: 'Duración', value: `${duration} min`, mono: false },
    ...(bookingType === 'BLOQUEO'
      ? [{ label: 'Tipo', value: `🔒 Bloqueo${blockReason ? ` — ${blockReason}` : ''}`, mono: false }]
      : [
          { label: 'Tipo', value: typeLabel, mono: false },
          { label: 'Cliente', value: clientName, mono: false },
        ]),
  ]

  return (
    <div className="flex flex-col">
      <div className="mb-[22px]">
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
          Resumen
        </p>
        <div className="border border-border rounded-[14px] overflow-hidden">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center justify-between px-4 py-3 odd:bg-surface/55
                          ${i < rows.length - 1 ? 'border-b border-border/60' : ''}`}
            >
              <span className="text-xs text-muted">{r.label}</span>
              <span
                className={`text-sm font-semibold text-text text-right max-w-[58%]
                               ${r.mono ? 'font-mono' : ''}`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-[22px]">
        <div className="flex items-center justify-between px-[14px] py-[10px] rounded-xl bg-accent/8 border border-accent/25">
          <span className="text-xs text-muted">Estado al crear</span>
          <span className="text-[11px] font-bold px-[10px] py-[3px] rounded-full bg-accent/15 text-accent border border-accent/30">
            ✓ Confirmada
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-[22px] animate-wz-fade-in flex items-start gap-2 px-3 py-[10px] rounded-[10px] bg-red-400/8 border border-red-400/25 text-red-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-px">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs">{error}</p>
        </div>
      )}

      <div className="pt-[10px] flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="flex-1 px-5 py-3 rounded-xl border border-border bg-transparent text-muted
                     text-[13px] font-semibold cursor-pointer transition-all duration-[130ms]
                     enabled:hover:border-border-hover enabled:hover:text-text
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="flex-[2] px-5 py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
                     cursor-pointer transition-all duration-[130ms]
                     enabled:hover:bg-accent-dark active:enabled:scale-[.98]
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Creando…
            </span>
          ) : bookingType === 'BLOQUEO' ? (
            'Bloquear horario'
          ) : (
            'Confirmar reserva'
          )}
        </button>
      </div>
    </div>
  )
}
