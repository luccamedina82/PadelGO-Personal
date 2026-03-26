import type { PointerEvent as ReactPointerEvent } from 'react'
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
  isDragging?: boolean
  isResizing?: boolean
  heightOverride?: number
  isPast?: boolean
  onDragStart: (
    booking: BookingBlock,
    e: ReactPointerEvent<HTMLDivElement>,
    offsetY: number,
    onSelect: () => void
  ) => void
  onResizeStart: (booking: BookingBlock, e: ReactPointerEvent<HTMLDivElement>) => void
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
  isDragging,
  isResizing,
  heightOverride,
  isPast,
  onDragStart,
  onResizeStart,
  onSelect,
  onTooltipEnter,
  onTooltipMove,
  onTooltipLeave,
}: BookingBlockCellProps) {
  const startMin = timeToMinutes(b.startTime)
  const endTime = minutesToTime(startMin + b.durationMinutes)
  const top = ((startMin - gridStart) / 30) * SLOT_HEIGHT
  const baseHeight = (b.durationMinutes / 30) * SLOT_HEIGHT - 3
  const height = heightOverride ?? baseHeight
  const blockCls = getBlockClass(b.source, b.status, b.recurringBookingId)

  if (top < 0 || top > gridHeight) return null

  const isPaid = b.paymentStatus === 'PAID'
  const isUnpaid = !isPaid
  const isUnconfirmed = b.status === 'PENDING'
  const isCancelled = b.status === 'CANCELLED'
  const showPaymentRow = height > 52 && b.source !== 'BLOCK' && !isCancelled
  const isActive = !isCancelled

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isActive) return
    const offsetY = e.clientY - e.currentTarget.getBoundingClientRect().top
    onDragStart(b, e, offsetY, onSelect)
  }

  return (
    <div
      className={[
        'booking-block group',
        blockCls,
        isUnconfirmed ? 'booking-block-unconfirmed' : '',
        isHighlighted ? 'booking-block-highlighted' : '',
        isPast && !isDragging ? 'opacity-40 grayscale-[0.4]' : '',
        isDragging
          ? 'opacity-80 !scale-[1.02] shadow-xl cursor-grabbing z-50'
          : isActive
            ? 'cursor-grab hover:shadow-md transition-shadow'
            : '',
        isResizing ? 'select-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        top: top + 2,
        left: 5,
        right: 5,
        height: Math.max(height, 22),
      }}
      onPointerDown={handlePointerDown}
      onMouseEnter={(e) => !isDragging && onTooltipEnter(e.clientX, e.clientY)}
      onMouseMove={(e) => !isDragging && onTooltipMove(e.clientX, e.clientY)}
      onMouseLeave={onTooltipLeave}
    >
      {/* Name + unconfirmed clock */}
      <div className="flex items-start gap-1 min-w-0">
        <p className="text-[11px] font-bold leading-tight truncate flex-1">{b.displayName}</p>
        {isUnconfirmed && <IconClock className="w-3 h-3 shrink-0 opacity-80 mt-px" />}
      </div>

      {/* Time range */}
      {height > 34 && (
        <p className="text-[9px] font-mono leading-tight opacity-70">
          {b.startTime} – {endTime}
        </p>
      )}

      {/* Price + payment indicator */}
      {showPaymentRow && (
        <div className="flex items-center justify-between mt-auto gap-1">
          <p className={`text-[10px] font-semibold truncate ${isUnpaid ? 'text-red-400' : 'opacity-75'}`}>
            {formatPrice(b.totalPrice)}
          </p>
          {isPaid && <IconCheck className="w-3 h-3 text-green-400 shrink-0" />}
          {isUnpaid && <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />}
        </div>
      )}

      {/* Resize handle — only shown on hover at bottom of card */}
      {isActive && !isDragging && (
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-current opacity-0 group-hover:opacity-25 transition-opacity cursor-ns-resize"
          onPointerDown={(e) => onResizeStart(b, e)}
        />
      )}
    </div>
  )
}
