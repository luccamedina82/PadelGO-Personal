'use client'

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  FloatingPortal,
  detectOverflow,
  type Middleware,
} from '@floating-ui/react'
import FloatingBookingFormContent from './FloatingBookingFormContent'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { FloatingFormInitialData } from '@/app/(owner)/admin/reservas/BookingsClient'

interface FloatingBookingFormProps {
  anchorEl: HTMLElement | null
  virtualCoords?: { x: number; y: number; width: number; height: number }
  initialData: FloatingFormInitialData
  clubId: string
  courts: CourtColumn[]
  baseStart?: number
  baseEnd?: number
  baseBookingRule?: { startTime: string; endTime: string; price: number | null } | null
  onClose: () => void
  onCreated: (bookingId?: string) => void
}

// When flip exhausts all side placements and the panel still overflows,
// center it horizontally over the anchor cell (Google Calendar-style overlap).
const centerFallback: Middleware = {
  name: 'centerFallback',
  async fn(state) {
    const { rects, placement } = state
    if (!placement.startsWith('right') && !placement.startsWith('left')) return {}
    const overflow = await detectOverflow(state, { padding: 8 })
    const currentSideOverflows =
      (placement.startsWith('right') && overflow.right > 0) ||
      (placement.startsWith('left') && overflow.left > 0)
    if (!currentSideOverflows) return {}
    return {
      x: rects.reference.x + rects.reference.width / 2 - rects.floating.width / 2,
    }
  },
}

export default function FloatingBookingForm(props: FloatingBookingFormProps) {
  const { anchorEl, virtualCoords, onClose } = props

  // Hydration guard — render nothing on SSR, mount on client only
  const [isMounted, setIsMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    setIsMounted(true)
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Build a virtual element from coordinates with real dimensions so
  // flip/shift have a proper rect to work against
  const virtualEl = useMemo(() => {
    if (!virtualCoords) return null
    const { x, y, width, height } = virtualCoords
    return {
      getBoundingClientRect: () =>
        ({
          x, y,
          top: y, left: x,
          right: x + width,
          bottom: y + height,
          width, height,
        } as DOMRect),
    }
  }, [virtualCoords])

  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => { if (!open) onClose() },
    placement: 'right-start',
    middleware: [
      offset(12),
      flip({ fallbackPlacements: ['left-start'], padding: 10, rootBoundary: 'viewport' }),
      centerFallback,
      shift({ padding: { left: 280, right: 16, top: 16, bottom: 16 }, rootBoundary: 'viewport' }),
    ],
    // Track scroll + resize so the panel follows the cell as the user scrolls
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, {
        ancestorScroll: true,
        ancestorResize: true,
        elementResize: true,
      }),
  })

  // Real DOM elements → refs.setReference
  // Virtual elements  → refs.setPositionReference (floating-ui requirement)
  // useLayoutEffect fires before paint → eliminates first-frame flash
  useLayoutEffect(() => {
    if (anchorEl) {
      refs.setReference(anchorEl)
    } else if (virtualEl) {
      refs.setPositionReference(virtualEl)
    }
  }, [anchorEl, virtualEl, refs])

  // ancestorScroll: false → scroll moves the panel (via autoUpdate), does NOT close it
  const dismiss = useDismiss(context, { ancestorScroll: false })
  const { getFloatingProps } = useInteractions([dismiss])

  const formWidth = props.initialData.mode === 'full' ? 400 : 340

  if (!isMounted) return null

  // ── Mobile: bottom sheet ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <FloatingPortal>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[70] bg-black/50 animate-in fade-in duration-200"
          onClick={onClose}
        />
        {/* Sheet */}
        <div className="fixed bottom-0 left-0 right-0 z-[71] rounded-t-2xl border-t border-border bg-card shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          <div className="overflow-hidden flex-1">
            <FloatingBookingFormContent {...props} />
          </div>
        </div>
      </FloatingPortal>
    )
  }

  // ── Desktop: centered panel when no anchor (global "Nueva reserva" button) ──
  if (!anchorEl && !virtualCoords) {
    return (
      <FloatingPortal>
        <div
          className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <div
            className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ width: formWidth }}
          >
            <FloatingBookingFormContent {...props} />
          </div>
        </div>
      </FloatingPortal>
    )
  }

  // ── Desktop: anchor-positioned panel (cell click or drag-create) ─────────
  return (
    <FloatingPortal>
      {/* Closure shield: invisible backdrop intercepts all pointer events before they reach the grid */}
      <div
        className="fixed inset-0 z-[79]"
        onPointerDown={(e) => { e.stopPropagation(); onClose() }}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, width: formWidth }}
        className="z-[80] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        {...getFloatingProps()}
      >
        <FloatingBookingFormContent {...props} />
      </div>
    </FloatingPortal>
  )
}
