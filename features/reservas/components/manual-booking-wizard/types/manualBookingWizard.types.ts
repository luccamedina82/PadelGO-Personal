import type { ActionResult } from '@/types'

export interface Court {
  id: string
  name: string
  type: string
  covered: boolean
}

export interface AvailabilitySlot {
  time: string
  available: boolean
  durationOptions: number[]
  pricePerHour: number
}

export interface CourtSlots {
  courtId: string
  slots: AvailabilitySlot[]
}

export type BookingType = 'PRESENCIAL' | 'TELEFONO' | 'BLOQUEO'

export interface ManualBookingWizardProps {
  courts: Court[]
  courtSlotsByDate: Record<string, CourtSlots[]>
  availableDates: string[]
  clubId: string
  createManualBookingAction: (input: {
    clubId: string
    courtId: string
    date: string
    startTime: string
    durationMinutes: number
    bookingType: BookingType
    manualName?: string
    manualPhone?: string
    blockReason?: string
    blockSource?: string
  }) => Promise<ActionResult<{ bookingId: string }>>
  defaultCourtId?: string
  defaultDate?: string
  defaultTime?: string
  onClose?: (date: string) => void
  onBookingCreated?: (payload: { date: string; bookingId?: string }) => void
  durationOptions: number[]
  dateHasSlots?: Record<string, boolean>
}

export const BOOKING_TYPES: { id: BookingType; icon: string; label: string }[] = [
  { id: 'PRESENCIAL', icon: '👤', label: 'Presencial' },
  { id: 'TELEFONO', icon: '📞', label: 'Teléfono' },
  { id: 'BLOQUEO', icon: '🔒', label: 'Bloqueo' },
]
