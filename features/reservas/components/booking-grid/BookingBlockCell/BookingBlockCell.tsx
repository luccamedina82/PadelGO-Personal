import {
  SLOT_HEIGHT,
  timeToMinutes,
  minutesToTime,
  formatPrice,
  getBlockClass,
  getSourceLabel,
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
  const label = getSourceLabel(b.source, b.status, b.recurringBookingId)

  if (top < 0 || top > gridHeight) return null

  // Chip de pago: texto completo si hay espacio, dot si el bloque es pequeño
  const payChip =
    b.paymentStatus === 'PAID'
      ? { text: 'Pagado', dot: 'bg-green-400', chip: 'bg-green-400/10 text-green-400 border-green-400/25' }
      : b.paymentStatus === 'MANUAL'
        ? { text: 'Manual', dot: 'bg-gray-400', chip: 'bg-gray-400/10 text-gray-400 border-gray-400/20' }
        : { text: 'Pendiente', dot: 'bg-orange-400', chip: 'bg-orange-400/10 text-orange-400 border-orange-400/25' }

  const showChip = height > 68 && b.source !== 'BLOCK' && b.status !== 'CANCELLED'
  const showDot  = height > 52 && !showChip && b.source !== 'BLOCK' && b.status !== 'CANCELLED'

  return (
    <div
      className={`booking-block ${blockCls}${isHighlighted ? ' booking-block-highlighted' : ''}`}
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
      {/* Grupo superior: nombre + horario */}
      <p className="text-[11px] font-bold leading-tight truncate">{b.displayName}</p>
      {height > 34 && (
        <p className="text-[9px] font-mono leading-tight opacity-70">
          {b.startTime} – {endTime}
        </p>
      )}

      {/* Grupo inferior: precio + estado de pago */}
      {height > 52 && b.source !== 'BLOCK' && (
        <div className="flex items-center justify-between mt-auto gap-1">
          <p className="text-[10px] font-semibold opacity-75 truncate">{formatPrice(b.totalPrice)}</p>
          {showChip && (
            <span className={`shrink-0 text-[9px] font-bold px-1 py-px rounded border leading-none ${payChip.chip}`}>
              {payChip.text}
            </span>
          )}
          {showDot && (
            <div className={`w-2 h-2 rounded-full shrink-0 ${payChip.dot}`} />
          )}
        </div>
      )}

      {/* Label de tipo — solo visible en bloques con espacio, sin superponerse al chip */}
      {height > 52 && (
        <span
          className="absolute top-1.5 right-1.5 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded opacity-70"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
