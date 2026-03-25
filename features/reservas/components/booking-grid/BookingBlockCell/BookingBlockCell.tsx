import {
  SLOT_HEIGHT,
  timeToMinutes,
  minutesToTime,
  formatPrice,
  getBlockClass,
} from '../helpers/bookingGrid.helpers'
import type { BookingBlock } from '../types/bookingGrid.types'

interface BookingBlockCellProps {
  booking: BookingBlock
  gridStart: number
  gridHeight: number
  isHighlighted: boolean
  onSelect: () => void
  onTooltipEnter: (x: number, y: number) => void
  onTooltipMove: (x: number, y: number) => void
  onTooltipLeave: () => void
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 3.5V6l1.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function BookingBlockCell({
  booking: b,
  gridStart,
  gridHeight,
  isHighlighted,
  onSelect,
  onTooltipEnter,
  onTooltipMove,
  onTooltipLeave,
}: BookingBlockCellProps) {
  const startMin = timeToMinutes(b.startTime)
  const endTime = minutesToTime(startMin + b.durationMinutes)
  const top = ((startMin - gridStart) / 30) * SLOT_HEIGHT
  const height = (b.durationMinutes / 30) * SLOT_HEIGHT - 3
  const blockCls = getBlockClass(b.source, b.status, b.recurringBookingId)

  if (top < 0 || top > gridHeight) return null

  const isPaid = b.paymentStatus === 'PAID'
  const isManualPaid = b.paymentStatus === 'MANUAL'
  const isUnpaid = !isPaid && !isManualPaid
  const isUnconfirmed = b.status === 'PENDING'
  const showPaymentRow = height > 52 && b.source !== 'BLOCK' && b.status !== 'CANCELLED'

  return (
    <div
      className={`booking-block ${blockCls}${isUnconfirmed ? ' booking-block-unconfirmed' : ''}${isHighlighted ? ' booking-block-highlighted' : ''}`}
      style={{
        top: top + 2,
        left: 5,
        right: 5,
        height: Math.max(height, 22),
      }}
      onClick={onSelect}
      onMouseEnter={(e) => onTooltipEnter(e.clientX, e.clientY)}
      onMouseMove={(e) => onTooltipMove(e.clientX, e.clientY)}
      onMouseLeave={onTooltipLeave}
    >
      {/* Nombre + reloj si sin confirmar */}
      <div className="flex items-start gap-1 min-w-0">
        <p className="text-[11px] font-bold leading-tight truncate flex-1">{b.displayName}</p>
        {isUnconfirmed && (
          <IconClock className="w-3 h-3 shrink-0 opacity-80 mt-px" />
        )}
      </div>

      {/* Horario */}
      {height > 34 && (
        <p className="text-[9px] font-mono leading-tight opacity-70">
          {b.startTime} – {endTime}
        </p>
      )}

      {/* Precio + indicador de pago */}
      {showPaymentRow && (
        <div className="flex items-center justify-between mt-auto gap-1">
          <p className={`text-[10px] font-semibold truncate ${isUnpaid ? 'text-red-400' : 'opacity-75'}`}>
            {formatPrice(b.totalPrice)}
          </p>
          {isPaid && <IconCheck className="w-3 h-3 text-green-400 shrink-0" />}
          {isManualPaid && <IconCheck className="w-3 h-3 text-gray-400 shrink-0" />}
          {isUnpaid && <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />}
        </div>
      )}
    </div>
  )
}
