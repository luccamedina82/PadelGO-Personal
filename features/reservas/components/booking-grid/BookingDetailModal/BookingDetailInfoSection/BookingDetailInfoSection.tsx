import type { BookingBlock } from '../../types/bookingGrid.types'
import { formatPrice } from '@/lib/availability'
import { isBlockSource } from '../../helpers/bookingGrid.helpers'

interface BookingDetailInfoSectionProps {
  booking: BookingBlock
  endTime: string
  statusLabel: string
  statusColor: string
  payLabel: string
  payColor: string
}

export default function BookingDetailInfoSection({
  booking,
  endTime,
  statusLabel,
  statusColor,
  payLabel,
  payColor,
}: BookingDetailInfoSectionProps) {
  const isBlock = isBlockSource(booking.source)

  return (
    <div className="space-y-1 mb-5">
      {/* Aviso fuera de horario */}
      {booking.outOfHoursWarning && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="shrink-0" style={{ color: '#f59e0b' }}>
            <path d="M6 1L11 10H1L6 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M6 5v2.5M6 8.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>Reserva fuera de horario habitual</span>
        </div>
      )}

      {/* Partido abierto */}
      {booking.isOpenMatch && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
          style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: '#a3e635' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
          <span className="text-xs font-medium" style={{ color: '#a3e635' }}>Partido abierto</span>
        </div>
      )}

      {/* Rows */}
      {[
        { label: 'Cliente', value: booking.displayName, mono: false },
        ...(booking.manualPhone ? [{ label: 'Teléfono', value: booking.manualPhone, mono: true }] : []),
        { label: 'Horario', value: `${booking.startTime} – ${endTime}`, mono: true },
        { label: 'Duración', value: `${booking.durationMinutes} min`, mono: false },
        ...(!isBlock ? [{ label: 'Total', value: formatPrice(booking.totalPrice), mono: true }] : []),
      ].map(({ label, value, mono }) => (
        <div key={label} className="flex justify-between items-center py-1.5">
          <span className="text-xs text-muted">{label}</span>
          <span className={`text-sm font-medium text-text ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
      ))}

      <div className="flex justify-between items-center py-1.5 mt-1 border-t border-border">
        <span className="text-xs text-muted">Estado</span>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full bg-card border border-border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {!isBlock && (
        <div className="flex justify-between items-center py-1.5">
          <span className="text-xs text-muted">Pago</span>
          <span className={`text-xs font-semibold ${payColor}`}>{payLabel}</span>
        </div>
      )}
    </div>
  )
}
