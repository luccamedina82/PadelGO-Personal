import { FloatingFormInitialData } from '@/app/(owner)/admin/reservas/BookingsClient';
import { create } from 'zustand'

interface BookingFormState {
  isOpen: boolean
  anchorEl: HTMLElement | null
  virtualCoords?: { x: number; y: number; width: number; height: number }
  initialData: FloatingFormInitialData | null
  /** Live duration from the open form — updated as user changes duration. Null when closed. */
  liveDuration: number | null

  // Acciones
  openForm: (initialData: FloatingFormInitialData, anchorEl?: HTMLElement | null, coords?: any) => void
  closeForm: () => void
  setLiveDuration: (d: number | null) => void
}

export const useBookingFormStore = create<BookingFormState>((set) => ({
  isOpen: false,
  anchorEl: null,
  initialData: null,
  virtualCoords: undefined,
  liveDuration: null,

  openForm: (initialData, anchorEl = null, virtualCoords) =>
    set({ isOpen: true, initialData, anchorEl, virtualCoords, liveDuration: initialData.durationMinutes ?? null }),

  closeForm: () =>
    set({ isOpen: false, initialData: null, anchorEl: null, virtualCoords: undefined, liveDuration: null }),

  setLiveDuration: (d) => set({ liveDuration: d }),
}))