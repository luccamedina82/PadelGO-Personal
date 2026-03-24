import type { createBooking, createGhostBooking } from '@/actions/booking'
import type {
  createMercadoPagoPreference,
  setGuestManualPayment,
  setManualPayment,
} from '@/actions/payment'
import type { DurationMinutes, AvailabilityConfig, ExistingBooking } from '@/lib/availability'
import type { CourtType } from '@/types'

export interface CourtForWizard {
  id: string
  name: string
  type: CourtType
  covered: boolean
  svgX: number
  svgY: number
  svgW: number
  svgH: number
  isActive: boolean
  availabilityByDay: Record<number, AvailabilityConfig>
}

export type BookingMap = Record<string, Record<string, ExistingBooking[]>>
export type BookingStep = 1 | 2 | 3 | 4
export type Period = 'Mañana' | 'Tarde' | 'Noche'

export interface BookingWizardProps {
  clubId: string
  clubName: string
  cancelHoursBeforeStart: number
  courts: CourtForWizard[]
  existingBookings: BookingMap
  userId: string | null
  createBookingAction: typeof createBooking
  createGhostBookingAction: typeof createGhostBooking
  createMercadoPagoPreferenceAction: typeof createMercadoPagoPreference
  setManualPaymentAction: typeof setManualPayment
  setGuestManualPaymentAction: typeof setGuestManualPayment
}

export interface GuestState {
  name: string
  email: string
  ready: boolean
  error: string | null
}

export interface CooldownState {
  active: boolean
  pct: number
}

export type PaymentMethod = 'mp' | 'cash' | null

export type WizardSelection = {
  selectedDate: Date
  selectedCourtId: string | null
  selectedTime: string | null
  selectedDuration: DurationMinutes
}