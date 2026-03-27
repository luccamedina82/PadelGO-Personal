'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import ManualBookingWizard from '@/features/reservas/components/manual-booking-wizard/ManualBookingWizard'
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
  durationOptions: number[]
  dateHasSlots?: Record<string, boolean>
}

export default function ModalBookingWizardClient(props: ModalBookingWizardClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function closeToDate() {
    router.back()
  }

  function handleBookingCreated(payload: { date: string; bookingId?: string }) {
    // Dispatch event to trigger TanStack Query invalidation
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reservas:refresh', { detail: payload }))
    }

    // Immediately close the modal
    router.back()

    // Refresh server data to ensure new booking appears
    setTimeout(() => {
      router.refresh()
    }, 600)
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
