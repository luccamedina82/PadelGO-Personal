import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getWeekStart } from '@/lib/date'
import { createManualBooking } from '@/features/reservas/actions/bookings'
import type { QueryClient } from '@tanstack/react-query'
import type { FormState, FormAction } from '../helpers/formReducer'
import type { BookingBlock } from '@/features/reservas/components/booking-grid/types/bookingGrid.types'

interface Params {
  canSubmit: boolean
  form: FormState
  dispatch: React.Dispatch<FormAction>
  clubId: string
  isOOB: boolean
  basePrice: number
  initialDate: string
  queryClient: QueryClient
  onCreated: (id?: string) => void
  saveClient: (name: string, phone?: string) => void
}

export function useSubmitBooking({
  canSubmit, form, dispatch, clubId, isOOB, basePrice,
  initialDate, queryClient, onCreated, saveClient,
}: Params) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    dispatch({ type: 'SET_FIELD', field: 'error', value: null })
    const priceOverride =
      form.bookingMode === 'RESERVA' && form.priceOverrideEnabled && form.priceOverrideInput.trim() !== ''
        ? parseInt(form.priceOverrideInput, 10) * 100 : undefined
    const payload = form.bookingMode === 'RESERVA'
      ? { clubId, courtId: form.courtId, date: form.date, startTime: form.startTime, durationMinutes: form.duration, bookingType: 'PRESENCIAL' as const, manualName: form.noClient ? undefined : (form.clientName.trim() || undefined), manualPhone: form.noClient ? undefined : (form.clientPhone.trim() || undefined), priceOverride, outOfHoursWarning: isOOB }
      : { clubId, courtId: form.courtId, date: form.date, startTime: form.startTime, durationMinutes: form.duration, bookingType: 'BLOQUEO' as const, blockReason: form.motivo.trim() || undefined }

    startTransition(async () => {
      const result = await createManualBooking(payload)
      if (result.success && result.data) {
        const bookingId = result.data.bookingId
        if (form.bookingMode === 'RESERVA' && !form.noClient && form.clientName.trim()) {
          saveClient(form.clientName.trim(), form.clientPhone.trim() || undefined)
        }
        toast.success(form.bookingMode === 'BLOQUEO' ? 'Bloqueo creado' : 'Reserva creada', { position: 'bottom-right' })
        const bookingWeekStart = getWeekStart(payload.date)
        queryClient.invalidateQueries({ queryKey: ['bookings', clubId, 'week', bookingWeekStart] })
        queryClient.invalidateQueries({ queryKey: ['floatingData', clubId, payload.date] })
        const optimisticBooking: BookingBlock = {
          id: bookingId, clubId, courtId: payload.courtId, startTime: payload.startTime,
          durationMinutes: payload.durationMinutes, status: 'CONFIRMED',
          source: payload.bookingType === 'BLOQUEO' ? 'BLOCK' : 'MANUAL_STAFF',
          displayName: payload.bookingType === 'BLOQUEO'
            ? (('blockReason' in payload && payload.blockReason) || 'Bloqueo')
            : (('manualName' in payload && payload.manualName) || '—'),
          totalPrice: priceOverride ?? basePrice, paymentStatus: 'UNPAID',
          manualPhone: 'manualPhone' in payload ? (payload.manualPhone ?? null) : null,
          date: payload.date,
        }
        if (payload.date === initialDate) {
          queryClient.setQueryData(['bookings', clubId, 'week', bookingWeekStart], (old: BookingBlock[] | undefined) => [...(old ?? []), optimisticBooking])
          onCreated(bookingId)
        } else {
          onCreated(bookingId)
          router.push(`/admin/reservas?date=${payload.date}&highlight=${bookingId}`)
        }
      } else {
        const errorMsg = ('error' in result ? (result.error as string) : null) ?? 'Error al crear la reserva.'
        toast.error(errorMsg, { position: 'bottom-right' })
        dispatch({ type: 'SET_FIELD', field: 'error', value: errorMsg })
      }
    })
  }, [canSubmit, form, clubId, isOOB, basePrice, initialDate, queryClient, router, onCreated, startTransition, dispatch, saveClient])

  return { handleSubmit, isPending }
}
