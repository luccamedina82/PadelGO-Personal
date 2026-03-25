'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  cancelBooking,
  confirmBooking,
  updatePaymentStatus,
  updateBooking,
  updateBookingPlayers,
  createManualBooking,
  convertBookingToOpenMatch,
  type CreateManualBookingInput,
  type UpdateBookingInput,
  type ConvertToOpenMatchInput,
} from '@/features/reservas/actions/bookings'

export function useBookingMutations(clubId: string) {
  const queryClient = useQueryClient()

  function patchBookingsCache(
    updater: (booking: Record<string, unknown>) => Record<string, unknown> | null
  ) {
    queryClient.setQueriesData({ queryKey: ['bookings', clubId] }, (old) => {
      if (!Array.isArray(old)) return old
      const next = old
        .map((item) => {
          if (!item || typeof item !== 'object') return item
          const patched = updater(item as Record<string, unknown>)
          return patched ?? null
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
      return next
    })
  }

  // 1. El "Gatillo" centralizado: Invalida y fuerza refetch de reservas activas
  const invalidateBookings = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings', clubId] })
    await queryClient.refetchQueries({ queryKey: ['bookings', clubId], type: 'active' })
  }

  // 2. Las Mutaciones
  const cancel = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: async (res, id) => {
      if (res.success) {
        // Cancelled bookings are excluded by server filters, so remove it immediately.
        patchBookingsCache((booking) => (booking.id === id ? null : booking))
        await invalidateBookings()
      }
    },
  })

  const confirm = useMutation({
    mutationFn: (id: string) => confirmBooking(id),
    onSuccess: async (res, id) => {
      if (res.success) {
        patchBookingsCache((booking) =>
          booking.id === id ? { ...booking, status: 'CONFIRMED' } : booking
        )
        await invalidateBookings()
      }
    },
  })

  const updatePayment = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PAID' | 'UNPAID' | 'MANUAL' }) =>
      updatePaymentStatus(id, status),
    onSuccess: async (res, variables) => {
      if (res.success) {
        patchBookingsCache((booking) =>
          booking.id === variables.id ? { ...booking, paymentStatus: variables.status } : booking
        )
        await invalidateBookings()
      }
    },
  })

  const createManual = useMutation({
    mutationFn: (data: CreateManualBookingInput) => createManualBooking(data),
    onSuccess: async (res) => {
      if (res.success) await invalidateBookings()
    },
  })

  const updateTime = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingInput }) => updateBooking(id, data),
    onSuccess: async (res, variables) => {
      if (res.success) {
        patchBookingsCache((booking) =>
          booking.id === variables.id
            ? {
                ...booking,
                startTime: variables.data.startTime,
                durationMinutes: variables.data.durationMinutes,
                ...(variables.data.courtId !== undefined
                  ? { courtId: variables.data.courtId }
                  : {}),
                ...(variables.data.manualName !== undefined
                  ? { displayName: variables.data.manualName }
                  : {}),
                ...(variables.data.manualPhone !== undefined
                  ? { manualPhone: variables.data.manualPhone }
                  : {}),
              }
            : booking
        )
        await invalidateBookings()
      }
    },
  })

  const updatePlayers = useMutation({
    mutationFn: ({
      id,
      playerIds,
      paidPlayerIds,
    }: {
      id: string
      playerIds: string[]
      paidPlayerIds: string[]
    }) => updateBookingPlayers(id, playerIds, paidPlayerIds),
    onSuccess: async (res, variables) => {
      if (res.success) {
        patchBookingsCache((booking) =>
          booking.id === variables.id
            ? { ...booking, paidPlayerIds: variables.paidPlayerIds }
            : booking
        )
        await invalidateBookings()
      }
    },
  })

  const convertToOpenMatch = useMutation({
    mutationFn: (data: ConvertToOpenMatchInput) => convertBookingToOpenMatch(data),
    onSuccess: async (res) => {
      if (res.success) {
        await invalidateBookings()
        // Si abrís un partido, también refrescamos la lista de Open Matches
        queryClient.invalidateQueries({ queryKey: ['open-matches', clubId] })
      }
    },
  })

  // 3. Devolvemos la "caja de herramientas"
  return {
    cancel,
    confirm,
    updatePayment,
    createManual,
    updateTime,
    updatePlayers,
    convertToOpenMatch,
  }
}
