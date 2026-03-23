'use client'

import { useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()

  function closeToDate() {
    router.back()
  }

  function handleBookingCreated(payload: { date: string; bookingId?: string }) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reservas:refresh', { detail: payload }))
    }

    // Close intercepted modal first; BookingsClient listens to the event and refetches.
    router.back()
    setTimeout(() => {
      router.refresh()
    }, 0)
  }
  return (
    <ManualBookingWizard
      key={searchParams.toString()}
      {...props}
      onClose={closeToDate}
      onBookingCreated={handleBookingCreated}
    />
  )
}
