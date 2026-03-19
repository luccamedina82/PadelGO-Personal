'use client'

import { useRouter } from 'next/navigation'
import ManualBookingWizard from '@/components/booking/ManualBookingWizard'
import type { ActionResult } from '@/types'

interface Court {
  id: string
  name: string
  type: string
  covered: boolean
}

interface CourtSlots {
  courtId: string
  slots: { time: string; available: boolean; durationOptions: number[]; pricePerHour: number }[]
}

interface ModalBookingWizardClientProps {
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
    bookingType: 'PRESENCIAL' | 'TELEFONO' | 'BLOQUEO'
    manualName?: string
    manualPhone?: string
    blockReason?: string
  }) => Promise<ActionResult<{ bookingId: string }>>
  defaultCourtId?: string
  defaultDate?: string
  defaultTime?: string
}

export default function ModalBookingWizardClient(props: ModalBookingWizardClientProps) {
  const router = useRouter()

  function closeToDate() {
    router.back()
  }

  function handleBookingCreated(payload: { date: string; bookingId?: string }) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reservas:refresh', { detail: payload }))
    }
    router.back()
  }

  return (
    <ManualBookingWizard
      {...props}
      onClose={closeToDate}
      onBookingCreated={handleBookingCreated}
    />
  )
}
