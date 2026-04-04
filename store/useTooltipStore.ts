import { create } from 'zustand'
import type { BookingBlock } from '@/features/reservas/components/booking-grid/types/bookingGrid.types'
import { clampTooltipPosition, shouldUpdateTooltipPosition } from '@/features/reservas/components/booking-grid/helpers/bookingGrid.helpers'

interface TooltipState {
  tooltip: { booking: BookingBlock; x: number; y: number } | null
  slotTooltip: { courtName: string; time: string; x: number; y: number } | null

  // Acciones para celdas vacías (Slots)
  setSlotTooltipStart: (courtName: string, time: string, x: number, y: number) => void
  updateSlotTooltipPos: (x: number, y: number) => void
  clearSlotTooltip: () => void

  // Acciones para reservas (Bookings)
  setBookingTooltipStart: (booking: BookingBlock, x: number, y: number) => void
  updateBookingTooltipPos: (x: number, y: number) => void
  clearBookingTooltip: () => void
}

export const useTooltipStore = create<TooltipState>((set, get) => ({
  tooltip: null,
  slotTooltip: null,

  setSlotTooltipStart: (courtName, time, x, y) => {
    const pos = clampTooltipPosition(x, y, 170, 62)
    set({ slotTooltip: { courtName, time, x: pos.x, y: pos.y } })
  },
  updateSlotTooltipPos: (x, y) => {
    const prev = get().slotTooltip
    if (!prev) return
    const pos = clampTooltipPosition(x, y, 170, 62)
    if (!shouldUpdateTooltipPosition(prev.x, prev.y, pos.x, pos.y)) return
    set({ slotTooltip: { ...prev, x: pos.x, y: pos.y } })
  },
  clearSlotTooltip: () => set({ slotTooltip: null }),

  setBookingTooltipStart: (booking, x, y) => {
    const pos = clampTooltipPosition(x, y, 220, 96)
    set({ tooltip: { booking, x: pos.x, y: pos.y } })
  },
  updateBookingTooltipPos: (x, y) => {
    const prev = get().tooltip
    if (!prev) return
    const pos = clampTooltipPosition(x, y, 220, 96)
    if (!shouldUpdateTooltipPosition(prev.x, prev.y, pos.x, pos.y)) return
    set({ tooltip: { ...prev, x: pos.x, y: pos.y } })
  },
  clearBookingTooltip: () => set({ tooltip: null }),
}))