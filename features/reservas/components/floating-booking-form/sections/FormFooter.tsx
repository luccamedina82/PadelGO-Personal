'use client'

import { type ReactNode } from 'react'

interface FormFooterProps {
  canSubmit: boolean
  isPending: boolean
  bookingMode: 'RESERVA' | 'BLOQUEO'
  startTime: string
  courtId: string
  clientName: string
  noClient: boolean
  blockEndTime?: string
  isOOB: boolean
  oobConfirmed: boolean
  onClose: () => void
  onSubmit: () => void
}

export default function FormFooter({
  canSubmit,
  isPending,
  bookingMode,
  startTime,
  courtId,
  clientName,
  noClient,
  blockEndTime,
  isOOB,
  oobConfirmed,
  onClose,
  onSubmit,
}: FormFooterProps) {
  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

  let label: ReactNode
  if (isPending) {
    label = (
      <span className="flex items-center justify-center gap-1.5">
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Creando…
      </span>
    )
  } else if (!startTime) {
    label = 'Selecciona un horario'
  } else if (!courtId) {
    label = 'Elegí una cancha'
  } else if (bookingMode === 'BLOQUEO' && !blockEndTime) {
    label = 'Elegí la hora fin'
  } else if (bookingMode === 'RESERVA' && !clientName.trim() && !noClient) {
    label = 'Ingresá el nombre del cliente'
  } else if (isOOB && !oobConfirmed) {
    label = 'Confirmá horario especial'
  } else {
    label = bookingMode === 'BLOQUEO' ? 'Confirmar bloqueo' : 'Guardar reserva'
  }

  return (
    <div className="px-4 py-3 border-t border-border flex gap-2 shrink-0">
      <button
        type="button"
        onClick={onClose}
        disabled={isPending}
        className={`flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted hover:text-text hover:border-border-hover transition-colors ${ring}`}
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isPending}
        className={`flex-[2] py-2.5 rounded-xl bg-accent text-accent-text text-[13px] font-bold cursor-pointer transition-all enabled:hover:bg-accent-dark active:enabled:scale-[.98] disabled:opacity-35 disabled:cursor-not-allowed ${ring}`}
      >
        {label}
      </button>
    </div>
  )
}
