'use client'

import type { BookingBlock } from '../booking-grid/types/bookingGrid.types'
import { formatPrice } from '@/lib/availability'

function getEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const endMin = (h ?? 0) * 60 + (m ?? 0) + durationMinutes
  return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
}

interface AgendaCardProps {
  booking: BookingBlock
  courtName: string
  onCobrar: () => void
  isPaying: boolean
}

export default function AgendaCard({ booking, courtName, onCobrar, isPaying }: AgendaCardProps) {
  const endTime = getEndTime(booking.startTime, booking.durationMinutes)
  const isPaid = booking.paymentStatus === 'PAID'
  const isUnpaid = booking.paymentStatus === 'UNPAID'

  return (
    <div className="flex items-stretch bg-card border border-border rounded-2xl shadow-sm hover:shadow-md hover:border-border-hover transition-all overflow-hidden">

      {/* Left: time */}
      <div className="flex flex-col justify-center px-4 py-3.5 min-w-[84px] shrink-0">
        <span className="text-2xl font-black tabular-nums text-text leading-none">{booking.startTime}</span>
        <span className="text-[11px] text-muted tabular-nums mt-1">hasta {endTime}</span>
      </div>

      {/* Center: court + player + source */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-3.5 border-l border-border/50">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-semibold bg-surface border border-border text-muted px-2 py-0.5 rounded-md">
            {courtName}
          </span>
          <SourceBadge source={booking.source} />
        </div>
        <span className="text-base font-bold text-text truncate leading-snug">
          {booking.displayName ?? '—'}
        </span>
      </div>

      {/* Right: price + payment status */}
      <div className="flex flex-col items-end justify-center gap-2 px-4 py-3.5 border-l border-border/50 shrink-0">
        <span className="text-sm font-bold tabular-nums text-text">
          {formatPrice(booking.totalPrice)}
        </span>
        {isPaid ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            100% PAGADO
          </span>
        ) : isUnpaid ? (
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 tabular-nums">
              FALTA PAGAR {formatPrice(booking.totalPrice)}
            </span>
            <button
              onClick={onCobrar}
              disabled={isPaying}
              className="px-3 py-1.5 bg-accent text-accent-text text-xs font-bold rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPaying ? 'Cobrando...' : 'Cobrar'}
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-muted px-2 py-1 rounded-lg bg-surface border border-border">
            Manual
          </span>
        )}
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: string }) {
  if (source === 'ONLINE')
    return (
      <span className="flex items-center gap-1 text-[10px] text-blue-400">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block shrink-0" />
        App
      </span>
    )
  if (source === 'MANUAL_OWNER' || source === 'MANUAL_SUPPORT')
    return (
      <span className="flex items-center gap-1 text-[10px] text-orange-400">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block shrink-0" />
        Manual
      </span>
    )
  return null
}
