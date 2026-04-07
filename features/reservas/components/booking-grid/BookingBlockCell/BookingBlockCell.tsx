import type { PointerEvent as ReactPointerEvent } from 'react'
import { timeToMinutes, minutesToTime, formatPrice } from '@/lib/availability'
import {
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
  slotHeight: number
  onDragStart: (
    booking: BookingBlock,
    e: ReactPointerEvent<HTMLDivElement>,
    offsetY: number,
    onSelect: (x: number, y: number) => void
  ) => void
  onResizeStart: (booking: BookingBlock, e: ReactPointerEvent<HTMLDivElement>) => void
  onSelect: (x: number, y: number) => void
  isFormOpen?: boolean
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
  slotHeight,
  onDragStart,
  onResizeStart,
  onSelect,
  isFormOpen,
}: BookingBlockCellProps) {
  const startMin = timeToMinutes(b.startTime)
  const endTime = minutesToTime(startMin + b.durationMinutes)
  const top = ((startMin - gridStart) / 30) * slotHeight
  const baseHeight = (b.durationMinutes / 30) * slotHeight - 3
  const height = heightOverride ?? baseHeight
  const blockCls = getBlockClass(b.source, b.status, b.recurringBookingId)

  if (top < 0 || top > gridHeight) return null

  const isPaid = b.paymentStatus === 'PAID'
  const isManualPaid = b.paymentStatus === 'MANUAL'
  const isEffectivelyPaid = isPaid || isManualPaid
  const isCancelled = b.status === 'CANCELLED'
  const isBlock = isBlockSource(b.source)
  const showPaymentRow = height > 52 && !isBlock && !isCancelled
  const isActive = !isCancelled

  const typeLabel = (() => {
    if (isBlock) return b.recurringBookingId ? 'FIJO' : 'BLOQUEO'
    if (b.recurringBookingId) return 'FIJO'
    if (b.source === 'ONLINE') return 'ONLINE'
    return 'MANUAL'
  })()

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isActive) return
    const offsetY = e.clientY - e.currentTarget.getBoundingClientRect().top
    e.stopPropagation()
    onDragStart(b, e, offsetY, onSelect)
  }

  return (
    <div
      id={`booking-${b.id}`}
      className={[
        'booking-block group',
        blockCls,
        isHighlighted ? 'booking-block-highlighted' : '',
        isPast && !isDragging ? 'opacity-40 grayscale-[0.4]' : '',
        isDragging ? 'opacity-40 !scale-[1.02] shadow-none cursor-grabbing z-50 select-none' : '',
        !isDragging && isActive && !isFormOpen ? 'cursor-grab hover:shadow-md transition-shadow' : '',
        isResizing ? 'select-none cursor-ns-resize' : '',
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

      {/* Time range */}
      {height > 34 && (
        <p className="text-[11px] font-mono leading-tight opacity-70">
          {b.startTime} – {endTime}
        </p>
      )}

      {/* Price (colored) + source type label */}
      {showPaymentRow && (
        <div className="flex items-center justify-between mt-auto gap-1">
          <p className={`text-[14px] font-bold ${isEffectivelyPaid ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(b.totalPrice)}
          </p>
          <span className="text-[9px] font-bold uppercase tracking-[0.06em] opacity-50 shrink-0">
            {typeLabel}
          </span>
        </div>
      )}

      {/* Resize handle */}
      {isActive && !isDragging && (
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-current opacity-0 group-hover:opacity-25 transition-opacity cursor-ns-resize"
          onPointerDown={(e) => {
            e.stopPropagation()
            onResizeStart(b, e)
          }}
        />
      )}
    </div>
  )
}
