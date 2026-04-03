'use server'

import { getAdminContext } from '@/lib/dal/admin'
import { getConflictBookings, getRecentCancellations } from '@/features/reservas/dal/conflicts'
import type { ConflictBooking, CancelledBooking } from '@/features/reservas/dal/conflicts'
import type { ActionResult } from '@/types'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'

export type { ConflictBooking, CancelledBooking }

export async function fetchConflictsAction(): Promise<
  ActionResult<{ conflicts: ConflictBooking[]; cancellations: CancelledBooking[] }>
> {
  const { club } = await getAdminContext(['OWNER', 'STAFF'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  try {
    const [conflicts, cancellations] = await Promise.all([
      getConflictBookings(club.id),
      getRecentCancellations(club.id),
    ])
    return { success: true, data: { conflicts, cancellations } }
  } catch (err) {
    console.error('[fetchConflictsAction]', err)
    return { success: false, error: 'Error al cargar conflictos.' }
  }
}

export async function approveExceptionAction(bookingId: string): Promise<ActionResult> {
  const { club } = await getAdminContext(['OWNER', 'STAFF'])
  if (!club) return { success: false, error: 'Sin autorización.' }

  try {
    const updated = await prisma.booking.updateMany({
      where: { id: bookingId, clubId: club.id, outOfHoursWarning: true, exceptionApprovedAt: null },
      data: { exceptionApprovedAt: new Date() },
    })
    if (updated.count === 0) return { success: false, error: 'Reserva no encontrada o ya aprobada.' }
    revalidateTag(`conflicts-${club.id}`, 'default')
    revalidateTag(`bookings-${club.id}`, 'default')
    return { success: true }
  } catch (err) {
    console.error('[approveExceptionAction]', err)
    return { success: false, error: 'Error al aprobar la excepción.' }
  }
}

export async function fetchSlotsForRelocAction(
  courtId: string,
  dateStr: string
): Promise<ActionResult<{ occupied: Array<{ startTime: string; durationMinutes: number }> }>> {
  const { club } = await getAdminContext(['OWNER', 'STAFF'])
  if (!club) return { success: false, error: 'Sin autorización.' }

  try {
    const dateObj = new Date(`${dateStr}T00:00:00.000Z`)
    const bookings = await prisma.booking.findMany({
      where: { courtId, date: dateObj, status: { in: ['PENDING', 'CONFIRMED'] } },
      select: { startTime: true, durationMinutes: true },
    })
    return { success: true, data: { occupied: bookings } }
  } catch (err) {
    console.error('[fetchSlotsForRelocAction]', err)
    return { success: false, error: 'Error al cargar disponibilidad.' }
  }
}
