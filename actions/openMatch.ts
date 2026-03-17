'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import { argToday } from '@/lib/date'
import type { ActionResult } from '@/types'

// ── TYPES ─────────────────────────────────────────────────────────────────

export interface CreateOpenMatchInput {
  bookingId: string
  requiredLevel: string // "3.0–5.0"
  spotsAvailable: number // 1–3
}

// ── CREATE OPEN MATCH ─────────────────────────────────────────────────────

/**
 * Mark an existing booking as an Open Match.
 * Only the booking owner can do this.
 */
export async function createOpenMatch(
  input: CreateOpenMatchInput
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireAuth()
  const { bookingId, requiredLevel, spotsAvailable } = input

  if (!bookingId) return { success: false, error: 'Reserva inválida.' }
  if (spotsAvailable < 1 || spotsAvailable > 3) {
    return { success: false, error: 'Los cupos deben ser entre 1 y 3.' }
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true, status: true, date: true, isOpenMatch: true },
    })

    if (!booking) return { success: false, error: 'Reserva no encontrada.' }
    if (booking.userId !== session.userId) {
      return { success: false, error: 'No tenés permiso para modificar esta reserva.' }
    }
    if (booking.isOpenMatch) {
      return { success: false, error: 'Esta reserva ya está abierta.' }
    }
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return { success: false, error: 'Solo podés publicar reservas pendientes o confirmadas.' }
    }

    // Must be in the future
    const now = argToday()
    if (booking.date < now) {
      return { success: false, error: 'No podés publicar una reserva pasada.' }
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { isOpenMatch: true, requiredLevel, spotsAvailable },
    })

    revalidatePath('/open-match')
    revalidatePath(`/confirmar/${bookingId}`)

    return { success: true, data: { bookingId } }
  } catch (err) {
    console.error('[createOpenMatch]', err)
    return { success: false, error: 'Error al publicar el turno abierto.' }
  }
}

// ── JOIN OPEN MATCH ───────────────────────────────────────────────────────

/**
 * Join an existing Open Match by adding oneself to playerIds.
 */
export async function joinOpenMatch(
  bookingId: string
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireAuth()

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { level: true } } },
    })

    if (!booking) return { success: false, error: 'Turno no encontrado.' }
    if (!booking.isOpenMatch) return { success: false, error: 'Este turno no es abierto.' }
    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      return { success: false, error: 'Este turno ya no está disponible.' }
    }
    if ((booking.spotsAvailable ?? 0) < 1) {
      return { success: false, error: 'No quedan cupos disponibles.' }
    }
    if (booking.playerIds.includes(session.userId)) {
      return { success: false, error: 'Ya estás anotado en este turno.' }
    }
    if (booking.userId === session.userId) {
      return { success: false, error: 'No podés unirte a tu propio turno.' }
    }

    // Level check if requiredLevel is set (format "3.0–5.0")
    if (booking.requiredLevel) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { level: true },
      })
      if (currentUser) {
        const [minStr, maxStr] = booking.requiredLevel.split('–').map((s) => parseFloat(s.trim()))
        if (currentUser.level < minStr || currentUser.level > maxStr) {
          return {
            success: false,
            error: `Tu nivel (${currentUser.level.toFixed(1)}) no está dentro del rango requerido (${booking.requiredLevel}).`,
          }
        }
      }
    }

    const newSpots = (booking.spotsAvailable ?? 1) - 1

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        playerIds: { push: session.userId },
        spotsAvailable: newSpots,
        isOpenMatch: newSpots > 0, // close when all spots filled
      },
    })

    revalidatePath('/open-match')

    return { success: true, data: { bookingId } }
  } catch (err) {
    console.error('[joinOpenMatch]', err)
    return { success: false, error: 'Error al unirte al turno.' }
  }
}
