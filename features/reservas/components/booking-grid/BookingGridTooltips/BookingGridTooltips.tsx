import type { BookingBlock } from '../types/bookingGrid.types'
import { formatPrice, isBlockSource, minutesToTime, timeToMinutes } from '../helpers/bookingGrid.helpers'

interface BookingGridTooltipsProps {
  tooltip: { booking: BookingBlock; x: number; y: number } | null
  slotTooltip: { courtName: string; time: string; x: number; y: number } | null
  selectedBooking: BookingBlock | null
  highlightedBooking: BookingBlock | undefined
}

export default function BookingGridTooltips({
  tooltip,
  slotTooltip,
  selectedBooking,
  highlightedBooking,
}: BookingGridTooltipsProps) {
  return (
    <>
      { highlightedBooking && !selectedBooking && (
        <div className="booking-new-toast" role="status" aria-live="polite">
          <p className="booking-new-toast-title">Reserva nueva detectada</p>
          <p className="booking-new-toast-sub">
            {highlightedBooking.displayName} · {highlightedBooking.startTime}
          </p>
        </div>
      )}

      {tooltip && !selectedBooking && (
        <div
          className="fixed z-50 pointer-events-none bg-surface/95 backdrop-blur-md border border-border-hover/70 rounded-xl shadow-2xl px-3 py-2.5 min-w-42.5 max-w-55"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-sm font-semibold text-text truncate mb-1">
            {tooltip.booking.displayName}
          </p>
          <p className="text-xs font-mono text-muted">
            {tooltip.booking.startTime} –{' '}
            {minutesToTime(
              timeToMinutes(tooltip.booking.startTime) + tooltip.booking.durationMinutes
            )}
            {' · '}
            {tooltip.booking.durationMinutes}m
          </p>
          {!isBlockSource(tooltip.booking.source) && (
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs font-mono text-text">
                {formatPrice(tooltip.booking.totalPrice)}
              </span>
              <span
                className={`text-[10px] font-bold ${
                  tooltip.booking.paymentStatus === 'PAID'
                    ? 'text-green-400'
                    : tooltip.booking.paymentStatus === 'MANUAL'
                      ? 'text-muted'
                      : 'text-orange-400'
                }`}
              >
                {tooltip.booking.paymentStatus === 'PAID'
                  ? 'Pagado'
                  : tooltip.booking.paymentStatus === 'MANUAL'
                    ? 'Manual'
                    : 'Pendiente'}
              </span>
            </div>
          )}
        </div>
      )}

      {slotTooltip && !selectedBooking && !tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-surface/95 backdrop-blur-md border border-border-hover/70 rounded-xl shadow-2xl px-3 py-2.5"
          style={{ left: slotTooltip.x, top: slotTooltip.y }}
        >
          <p className="text-[10px] uppercase tracking-wider text-muted leading-none">Disponible</p>
          <p className="text-[11px] font-semibold text-text leading-none mt-1">
            {slotTooltip.courtName}
          </p>
          <p className="text-[10px] font-mono text-muted mt-1">{slotTooltip.time}</p>
        </div>
      )}
    </>
  )
}
