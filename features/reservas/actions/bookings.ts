'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/features/auth/actions/auth'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import { calcBookingPrice, timeToMinutes, VALID_DURATIONS } from '@/lib/availability'
import { argToday } from '@/lib/date'
import type { ActionResult } from '@/types'

export interface CreateManualBookingInput {
  clubId: string
  courtId: string
  date: string
  startTime: string
  durationMinutes: number
  bookingType: 'PRESENCIAL' | 'TELEFONO' | 'BLOQUEO'
  manualName?: string
  manualPhone?: string
  blockReason?: string
  userId?: string
}

export async function createManualBooking(
  input: CreateManualBookingInput
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireRole(['OWNER', 'STAFF'])

  const {
    clubId,
    courtId,
    date,
    startTime,
    durationMinutes,
    bookingType,
    manualName,
    manualPhone,
    blockReason,
    userId,
  } = input

  if (!clubId || !courtId || !date || !startTime) {
    return { success: false, error: 'Datos incompletos.' }
  }

  if (!(VALID_DURATIONS as readonly number[]).includes(durationMinutes)) {
    return { success: false, error: 'Duración no válida. Opciones: 60, 90 o 120 minutos.' }
  }

  if (bookingType !== 'BLOQUEO' && !manualName?.trim() && !userId) {
    return { success: false, error: 'Ingresá el nombre del cliente o vinculá una cuenta.' }
  }

  const dateObj = new Date(`${date}T00:00:00.000Z`)
  if (isNaN(dateObj.getTime())) {
    return { success: false, error: 'Fecha inválida.' }
  }

  if (session.role === 'STAFF' && session.staffClubId !== clubId) {
    return { success: false, error: 'No tenés permisos para este club.' }
  }

  const newStartMin = timeToMinutes(startTime)
  const newEndMin = newStartMin + durationMinutes

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findMany({
        where: {
          courtId,
          date: dateObj,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { startTime: true, durationMinutes: true },
      })

      const conflict = existing.some((b) => {
        const bStart = timeToMinutes(b.startTime)
        const bEnd = bStart + b.durationMinutes
        return bStart < newEndMin && bEnd > newStartMin
      })

      if (conflict) throw new Error('SLOT_TAKEN')

      let totalPrice = 0
      if (bookingType !== 'BLOQUEO') {
        const dayOfWeek = dateObj.getUTCDay()
        const availability = await tx.courtAvailability.findFirst({
          where: { courtId, dayOfWeek, isActive: true },
          select: { pricePerHour: true },
        })
        if (availability) {
          totalPrice = calcBookingPrice(availability.pricePerHour, durationMinutes)
        }
      }

      const bookingUserId = userId ?? session.userId
      const source = bookingType === 'BLOQUEO' ? 'BLOCK' : 'MANUAL_OWNER'

      return tx.booking.create({
        data: {
          userId: bookingUserId,
          clubId,
          courtId,
          date: dateObj,
          startTime,
          durationMinutes,
          playerIds: [bookingUserId],
          status: 'CONFIRMED',
          totalPrice,
          paymentStatus: 'MANUAL',
          source,
          manualName: bookingType !== 'BLOQUEO' ? (manualName ?? null) : (blockReason ?? 'Bloqueo'),
          manualPhone: bookingType !== 'BLOQUEO' ? (manualPhone ?? null) : null,
        },
        select: { id: true },
      })
    })

    revalidateTag(`bookings-${clubId}`, 'default')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    revalidatePath(`/club/${clubId}`)

    return { success: true, data: { bookingId: booking.id } }
  } catch (err) {
    if (err instanceof Error && err.message === 'SLOT_TAKEN') {
      return { success: false, error: 'Ese horario ya está ocupado.' }
    }
    console.error('[createManualBooking]', err)
    return { success: false, error: 'Error al crear la reserva.' }
  }
}

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  const session = await requireRole(['OWNER', 'STAFF'])

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clubId: true, status: true },
    })

    if (!booking) return { success: false, error: 'Reserva no encontrada.' }
    if (session.role === 'STAFF' && session.staffClubId !== booking.clubId) {
      return { success: false, error: 'No tenés permisos para esta reserva.' }
    }
    if (booking.status === 'CANCELLED') {
      return { success: false, error: 'La reserva ya fue cancelada.' }
    }

    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
    revalidateTag(`bookings-${booking.clubId}`, 'default')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[cancelBooking]', err)
    return { success: false, error: 'Error al cancelar la reserva.' }
  }
}

export async function confirmBooking(bookingId: string): Promise<ActionResult> {
  const session = await requireRole(['OWNER', 'STAFF'])

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clubId: true, status: true },
    })

    if (!booking) return { success: false, error: 'Reserva no encontrada.' }
    if (session.role === 'STAFF' && session.staffClubId !== booking.clubId) {
      return { success: false, error: 'No tenés permisos para esta reserva.' }
    }

    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } })
    revalidateTag(`bookings-${booking.clubId}`, 'default')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[confirmBooking]', err)
    return { success: false, error: 'Error al confirmar la reserva.' }
  }
}

export async function updatePaymentStatus(
  bookingId: string,
  paymentStatus: 'PAID' | 'UNPAID' | 'MANUAL'
): Promise<ActionResult> {
  const session = await requireRole(['OWNER', 'STAFF'])

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clubId: true, status: true },
    })

    if (!booking) return { success: false, error: 'Reserva no encontrada.' }
    if (session.role === 'STAFF' && session.staffClubId !== booking.clubId) {
      return { success: false, error: 'No tenés permisos para esta reserva.' }
    }
    if (booking.status === 'CANCELLED') {
      return { success: false, error: 'No se puede modificar una reserva cancelada.' }
    }

    await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus } })
    revalidateTag(`bookings-${booking.clubId}`, 'default')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[updatePaymentStatus]', err)
    return { success: false, error: 'Error al actualizar el pago.' }
  }
}

export interface UpdateBookingInput {
  startTime: string
  durationMinutes: number
  manualName?: string
  manualPhone?: string
}

export async function updateBooking(
  bookingId: string,
  data: UpdateBookingInput
): Promise<ActionResult> {
  const session = await requireRole(['OWNER', 'STAFF'])

  const { startTime, durationMinutes, manualName, manualPhone } = data

  if (!(VALID_DURATIONS as readonly number[]).includes(durationMinutes)) {
    return { success: false, error: 'Duración no válida. Opciones: 60, 90 o 120 minutos.' }
  }

  const timeRegex = /^([01]\d|2[0-3]):([03]0)$/
  if (!timeRegex.test(startTime)) {
    return { success: false, error: 'El horario debe ser en intervalos de 30 minutos.' }
  }

  try {
    const { clubId } = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { clubId: true, courtId: true, date: true, status: true, source: true },
      })

      if (!booking) throw new Error('NOT_FOUND')
      if (session.role === 'STAFF' && session.staffClubId !== booking.clubId) {
        throw new Error('FORBIDDEN')
      }
      if (booking.status === 'CANCELLED') throw new Error('CANCELLED')

      const newStartMin = timeToMinutes(startTime)
      const newEndMin = newStartMin + durationMinutes

      // Conflict check excluding self
      const existing = await tx.booking.findMany({
        where: {
          courtId: booking.courtId,
          date: booking.date,
          status: { in: ['PENDING', 'CONFIRMED'] },
          id: { not: bookingId },
        },
        select: { startTime: true, durationMinutes: true },
      })

      const conflict = existing.some((b) => {
        const bStart = timeToMinutes(b.startTime)
        const bEnd = bStart + b.durationMinutes
        return bStart < newEndMin && bEnd > newStartMin
      })

      if (conflict) throw new Error('SLOT_TAKEN')

      const updateData: Record<string, unknown> = { startTime, durationMinutes }
      if (booking.source === 'MANUAL_OWNER') {
        if (manualName !== undefined) updateData.manualName = manualName || null
        if (manualPhone !== undefined) updateData.manualPhone = manualPhone || null
      }

      await tx.booking.update({ where: { id: bookingId }, data: updateData })
      return { clubId: booking.clubId }
    })

    revalidateTag(`bookings-${clubId}`, 'default')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return { success: false, error: 'Reserva no encontrada.' }
      if (err.message === 'FORBIDDEN')
        return { success: false, error: 'No tenés permisos para esta reserva.' }
      if (err.message === 'CANCELLED')
        return { success: false, error: 'No se puede editar una reserva cancelada.' }
      if (err.message === 'SLOT_TAKEN')
        return { success: false, error: 'Ese horario ya está ocupado.' }
    }
    console.error('[updateBooking]', err)
    return { success: false, error: 'Error al editar la reserva.' }
  }
}

export async function searchPlayers(
  query: string
): Promise<ActionResult<{ id: string; name: string; email: string }[]>> {
  const session = await requireRole(['OWNER', 'STAFF'])

  if (!query.trim() || query.trim().length < 2) {
    return { success: true, data: [] }
  }

  try {
    const club =
      session.role === 'STAFF'
        ? await prisma.club.findUnique({
            where: { id: session.staffClubId ?? '' },
            select: { id: true },
          })
        : await prisma.club.findFirst({
            where: { ownerId: session.userId },
            select: { id: true },
          })

    if (!club) return { success: false, error: 'Club no encontrado.' }

    const q = query.trim().toLowerCase()
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
        bookings: { some: { clubId: club.id } },
        isActive: true,
      },
      select: { id: true, name: true, email: true },
      take: 8,
      orderBy: { name: 'asc' },
    })

    return { success: true, data: users }
  } catch (err) {
    console.error('[searchPlayers]', err)
    return { success: false, error: 'Error en la búsqueda.' }
  }
}

export async function updateBookingPlayers(
  bookingId: string,
  playerIds: string[],
  paidPlayerIds: string[]
): Promise<ActionResult> {
  const session = await requireRole(['OWNER', 'STAFF'])

  if (playerIds.length > 4) {
    return { success: false, error: 'Máximo 4 jugadores por reserva.' }
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clubId: true, status: true },
    })

    if (!booking) return { success: false, error: 'Reserva no encontrada.' }
    if (session.role === 'STAFF' && session.staffClubId !== booking.clubId) {
      return { success: false, error: 'No tenés permisos para esta reserva.' }
    }
    if (booking.status === 'CANCELLED') {
      return { success: false, error: 'No se puede modificar una reserva cancelada.' }
    }

    // paidPlayerIds must be a subset of playerIds
    const validPaid = paidPlayerIds.filter((id) => playerIds.includes(id))

    await prisma.booking.update({
      where: { id: bookingId },
      data: { playerIds, paidPlayerIds: validPaid },
    })

    revalidateTag(`bookings-${booking.clubId}`, 'default')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[updateBookingPlayers]', err)
    return { success: false, error: 'Error al actualizar los jugadores.' }
  }
}

// ── CONVERT TO OPEN MATCH (ADMIN) ─────────────────────────────────────────────────

export interface ConvertToOpenMatchInput {
  bookingId: string
  requiredLevel: string
  spotsAvailable: number
}

export async function convertBookingToOpenMatch(
  input: ConvertToOpenMatchInput
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireRole(['OWNER', 'STAFF'])
  const { bookingId, requiredLevel, spotsAvailable } = input

  if (!bookingId) return { success: false, error: 'Reserva inválida.' }
  if (spotsAvailable < 1 || spotsAvailable > 3) {
    return { success: false, error: 'Los cupos deben ser entre 1 y 3.' }
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clubId: true, status: true, isOpenMatch: true, date: true, source: true },
    })

    if (!booking) return { success: false, error: 'Reserva no encontrada.' }

    // Check permissions
    if (session.role === 'STAFF' && session.staffClubId !== booking.clubId) {
      return { success: false, error: 'No tenés permisos para esta reserva.' }
    }

    if (booking.isOpenMatch) {
      return { success: false, error: 'Esta reserva ya está abierta.' }
    }

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return { success: false, error: 'Solo podés abrir reservas pendientes o confirmadas.' }
    }

    if (booking.source === 'BLOCK') {
      return { success: false, error: 'No se puede convertir un bloqueo a partido abierto.' }
    }

    // Must be in the future
    const today = argToday()
    if (booking.date < today) {
      return { success: false, error: 'Solo podés abrir reservas futuras.' }
    }

    // Update booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        isOpenMatch: true,
        requiredLevel,
        spotsAvailable,
      },
    })

    revalidateTag(`bookings-${booking.clubId}`, 'default')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin/open-matches')
    revalidatePath('/admin')
    return { success: true, data: { bookingId } }
  } catch (err) {
    console.error('[convertBookingToOpenMatch]', err)
    return { success: false, error: 'Error al convertir la reserva.' }
  }
}

// ── FETCH BOOKINGS (client-callable wrapper) ─────────────────────────────
// Server Action wrapper so Client Components (React Query queryFn) can
// call the cached DAL function getAdminBookingsByDate.

export async function fetchBookingsAction(
  clubId: string,
  startDateStr: string,
  endDateStr: string
) {
  const startDate = new Date(`${startDateStr}T00:00:00.000Z`)
  const endDate = new Date(`${endDateStr}T23:59:59.999Z`)
  return getAdminBookingsByDate(clubId, startDate, endDate)
}
