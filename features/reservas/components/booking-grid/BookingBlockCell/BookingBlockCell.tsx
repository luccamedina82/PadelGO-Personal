import type { PointerEvent as ReactPointerEvent } from 'react'
import { timeToMinutes, minutesToTime, formatPrice } from '@/lib/availability'
import {
  SLOT_HEIGHT,
  getBlockClass,
  isBlockSource,
} from '../helpers/bookingGrid.helpers'
import type { BookingBlock } from '../types/bookingGrid.types'

interface BookingBlockCellProps {
  booking: BookingBlock
  gridStart: number
  gridHeight: number
  isHighlighted: boolean
  isConflict?: boolean
  isDragging?: boolean
  isResizing?: boolean
  heightOverride?: number
  isPast?: boolean
  onDragStart: (
    booking: BookingBlock,
    e: ReactPointerEvent<HTMLDivElement>,
    offsetY: number,
    onSelect: (x: number, y: number) => void
  ) => void
  onResizeStart: (booking: BookingBlock, e: ReactPointerEvent<HTMLDivElement>) => void
  onSelect: (x: number, y: number) => void
  onTooltipEnter: (x: number, y: number) => void
  onTooltipMove: (x: number, y: number) => void
  onTooltipLeave: () => void
  isFormOpen?: boolean
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


export default function BookingBlockCell({
  booking: b,
  gridStart,
  gridHeight,
  isHighlighted,
  isConflict,
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
  isFormOpen,
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
  const isCancelled = b.status === 'CANCELLED'
  const isBlock = isBlockSource(b.source)
  const showPaymentRow = height > 52 && !isBlock && !isCancelled
  const showPaymentDot = !showPaymentRow && !isBlock && !isCancelled // compact: dot only
  const isActive = !isCancelled

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isActive) return
    const offsetY = e.clientY - e.currentTarget.getBoundingClientRect().top
    onDragStart(b, e, offsetY, onSelect)
  }

  return (
    <div
      id={`booking-${b.id}`}
      className={[
        'booking-block group',
        blockCls,
        !isBlock && !isCancelled ? (isPaid ? 'booking-block-paid' : 'booking-block-unpaid') : '',
        isHighlighted ? 'booking-block-highlighted' : '',
        isPast && !isDragging ? 'opacity-40 grayscale-[0.4]' : '',
        isDragging
          ? 'opacity-80 !scale-[1.02] shadow-xl cursor-grabbing z-50'
          : isActive
            ? `cursor-grab transition-shadow${isFormOpen ? '' : ' hover:shadow-md'}`
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
      onMouseEnter={(e) => !isDragging && !isFormOpen && onTooltipEnter(e.clientX, e.clientY)}
      onMouseMove={(e) => !isDragging && !isFormOpen && onTooltipMove(e.clientX, e.clientY)}
      onMouseLeave={onTooltipLeave}
    >
      {/* Conflict badge */}
      {isConflict && (
        <div
          className="absolute top-2 right-2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/50"
          title="Reserva con conflicto activo"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-amber-400">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      )}

      {/* Name */}
      <div className="flex items-start gap-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight line-clamp-2 flex-1">{b.displayName}</p>
      </div>

      {/* Time range + compact payment dot */}
      {height > 34 && (
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-mono leading-tight opacity-70 flex-1">
            {b.startTime} – {endTime}
          </p>
          {showPaymentDot && (
            isPaid
              ? <IconCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
              : <div className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
          )}
        </div>
      )}

      {/* Price + payment indicator (full row, taller slots) */}
      {showPaymentRow && (
        <div className="flex items-center justify-between mt-auto gap-1">
          <p className={`text-[14px] font-bold ${isPaid ? 'text-green-400' : 'text-orange-400'}`}>
            {formatPrice(b.totalPrice)}
          </p>
          {isPaid && <IconCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />}
          {isUnpaid && <div className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />}
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
