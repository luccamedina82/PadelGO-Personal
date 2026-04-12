'use client'

import { useEffect, useRef } from 'react'
import { FloatingPortal } from '@floating-ui/react'
import BookingDrawerContent from './BookingDrawerContent'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

interface BookingDrawerProps {
  clubId: string
  courts: CourtColumn[]
  initialDate: string
  initialCourtId?: string
  initialStartTime?: string
  initialDuration?: number
  onClose: () => void
  onCreated: (bookingId?: string) => void
}

export default function BookingDrawer({ clubId, courts, initialDate, initialCourtId, initialStartTime, initialDuration, onClose, onCreated }: BookingDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Cierra con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Previene scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Focus trap: foco inicial al panel
  useEffect(() => {
    const t = setTimeout(() => panelRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <FloatingPortal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="fixed top-0 right-0 h-full z-[71] w-[460px] max-w-[95vw] bg-card border-l border-border shadow-2xl flex flex-col outline-none animate-in slide-in-from-right duration-250"
      >
        <BookingDrawerContent
          clubId={clubId}
          courts={courts}
          initialDate={initialDate}
          initialCourtId={initialCourtId}
          initialStartTime={initialStartTime}
          initialDuration={initialDuration}
          onClose={onClose}
          onCreated={onCreated}
        />
      </div>
    </FloatingPortal>
  )
}
