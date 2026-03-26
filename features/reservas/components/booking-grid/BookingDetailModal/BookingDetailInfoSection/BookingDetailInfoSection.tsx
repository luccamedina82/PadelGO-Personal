import type { BookingBlock } from '../../types/bookingGrid.types'
import { formatPrice, isBlockSource } from '../../helpers/bookingGrid.helpers'

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
  return (
    <div className="space-y-3 mb-5">
      {[
        { label: 'Cliente', value: booking.displayName, mono: false },
        ...(booking.manualPhone ? [{ label: 'Teléfono', value: booking.manualPhone, mono: true }] : []),
        { label: 'Horario', value: `${booking.startTime} – ${endTime}`, mono: true },
        { label: 'Duración', value: `${booking.durationMinutes} min`, mono: false },
        ...(!isBlockSource(booking.source)
          ? [{ label: 'Total', value: formatPrice(booking.totalPrice), mono: true }]
          : []),
      ].map(({ label, value, mono }) => (
        <div key={label} className="flex justify-between items-center">
          <span className="text-xs text-muted">{label}</span>
          <span className={`text-sm font-medium text-text ${mono ? 'font-mono' : ''}`}>
            {value}
          </span>
        </div>
      ))}

      <div className="flex justify-between items-center pt-1 border-t border-border">
        <span className="text-xs text-muted">Estado</span>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full bg-card border border-border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {!isBlockSource(booking.source) && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted">Pago</span>
          <span className={`text-xs font-semibold ${payColor}`}>{payLabel}</span>
        </div>
      )}
    </div>
  )
}
