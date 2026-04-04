import { FloatingFormInitialData } from '@/app/(owner)/admin/reservas/BookingsClient';
import { create } from 'zustand'

interface BookingFormState {
  isOpen: boolean
  anchorEl: HTMLElement | null
  virtualCoords?: { x: number; y: number; width: number; height: number }
  initialData: FloatingFormInitialData | null
  
  // Acciones
  openForm: (initialData: FloatingFormInitialData, anchorEl?: HTMLElement | null, coords?: any) => void
  closeForm: () => void
}

export const useBookingFormStore = create<BookingFormState>((set) => ({
  isOpen: false,
  anchorEl: null,
  initialData: null,
  virtualCoords: undefined,
  
  openForm: (initialData, anchorEl = null, virtualCoords) => 
    set({ isOpen: true, initialData, anchorEl, virtualCoords }),
    
  closeForm: () => 
    set({ isOpen: false, initialData: null, anchorEl: null, virtualCoords: undefined }),
}))