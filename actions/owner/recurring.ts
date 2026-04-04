'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import { timeToMinutes } from '@/lib/availability'
import { getNextOccurrences, RECURRING_WEEKS_AHEAD } from '@/lib/recurring'
import { argToday } from '@/lib/date'
import type { ActionResult } from '@/types'

// ── INPUT TYPES ────────────────────────────────────────────────────────────

export interface CreateRecurringBookingInput {
  clubId: string
  courtId: string
  playerName: string
  playerPhone?: string
  dayOfWeek: number // 0=Dom … 6=Sáb
  startTime: string // "HH:MM"
  durationMinutes: number // 60, 90 o 120
  pricePerSession: number // centavos
}

export interface RecurringConflict {
  date: string // "YYYY-MM-DD"
  existingName: string
  existingTime: string
  existingDuration: number
}

// ── createRecurringBooking ─────────────────────────────────────────────────

/**
 * Creates a RecurringBooking record and materialises the next
 * RECURRING_WEEKS_AHEAD occurrences as BLOCK bookings.
 * Slots that already have a conflicting booking are skipped and reported.
 */
export async function createRecurringBooking(
  input: CreateRecurringBookingInput
): Promise<
  ActionResult<{ recurringId: string; bookingsCreated: number; conflicts: RecurringConflict[] }>
> {
  const session = await requireRole(['OWNER', 'STAFF'])

  const {
    clubId,
    courtId,
    playerName,
    playerPhone,
    dayOfWeek,
    startTime,
    durationMinutes,
    pricePerSession,
  } = input

  if (!playerName?.trim()) return { success: false, error: 'El nombre del jugador es obligatorio.' }
  if (!clubId || !courtId || !startTime) return { success: false, error: 'Datos incompletos.' }
  if (durationMinutes !== 60 && durationMinutes !== 90 && durationMinutes !== 120)
    return { success: false, error: 'Duración no válida. Opciones: 60, 90 o 120 minutos.' }
  if (dayOfWeek < 0 || dayOfWeek > 6) return { success: false, error: 'Día de semana inválido.' }
  if (pricePerSession < 0) return { success: false, error: 'El precio no puede ser negativo.' }

  if (session.role === 'STAFF' && session.staffClubId !== clubId) {
    return { success: false, error: 'No tenés permisos para este club.' }
  }

  // Verify court belongs to club
  const court = await prisma.court.findFirst({
    where: { id: courtId, clubId, isActive: true },
    select: { id: true },
  })
  if (!court) return { success: false, error: 'Cancha no encontrada.' }

  try {
    const today = argToday()

    const occurrenceDates = getNextOccurrences(dayOfWeek, today, RECURRING_WEEKS_AHEAD)

    const newStartMin = timeToMinutes(startTime)
    const newEndMin = newStartMin + durationMinutes

    const result = await prisma.$transaction(async (tx) => {
      // Create recurring booking record
      const recurring = await tx.recurringBooking.create({
        data: {
          clubId,
          courtId,
          playerName: playerName.trim(),
          playerPhone: playerPhone?.trim() ?? null,
          dayOfWeek,
          startTime,
          durationMinutes,
          pricePerSession,
          startDate: occurrenceDates[0],
          isActive: true,
          createdBy: session.userId,
        },
        select: { id: true },
      })

      // Materialise BLOCK bookings — skip any date with a conflicting booking
      let created = 0
      const conflicts: RecurringConflict[] = []
      for (const date of occurrenceDates) {
        const existing = await tx.booking.findMany({
          where: { courtId, date, status: { in: ['PENDING', 'CONFIRMED'] } },
          select: {
            startTime: true,
            durationMinutes: true,
            manualName: true,
            user: { select: { name: true } },
            source: true,
          },
        })
        const conflictingBooking = existing.find((b) => {
          const bStart = timeToMinutes(b.startTime)
          const bEnd = bStart + b.durationMinutes
          return bStart < newEndMin && bEnd > newStartMin
        })
        if (conflictingBooking) {
          const y = date.getUTCFullYear()
          const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
          const d = String(date.getUTCDate()).padStart(2, '0')
          const displayName =
            conflictingBooking.source === 'BLOCK'
              ? (conflictingBooking.manualName ?? 'Bloqueo')
              : (conflictingBooking.manualName ?? conflictingBooking.user.name)
          conflicts.push({
            date: `${y}-${mo}-${d}`,
            existingName: displayName,
            existingTime: conflictingBooking.startTime,
            existingDuration: conflictingBooking.durationMinutes,
          })
          continue
        }

        await tx.booking.create({
          data: {
            userId: session.userId,
            clubId,
            courtId,
            date,
            startTime,
            durationMinutes,
            playerIds: [],
            status: 'CONFIRMED',
            totalPrice: pricePerSession,
            paymentStatus: 'MANUAL',
            source: 'BLOCK',
            manualName: playerName.trim(),
            manualPhone: playerPhone?.trim() ?? null,
            recurringBookingId: recurring.id,
          },
        })
        created++
      }

      return { recurringId: recurring.id, bookingsCreated: created, conflicts }
    })

    revalidatePath('/admin/turnos-fijos')
    revalidatePath('/admin/reservas')

    return { success: true, data: result }
  } catch (err) {
    console.error('[createRecurringBooking]', err)
    return { success: false, error: 'Error al crear el turno fijo.' }
  }
}

// ── cancelRecurringBooking ────────────────────────────────────────────────

/**
 * Deactivates a recurring booking and cancels all future BLOCK bookings
 * generated from it.
 */
export async function cancelRecurringBooking(id: string, clubId: string): Promise<ActionResult> {
  const session = await requireRole(['OWNER', 'STAFF'])

  if (session.role === 'STAFF' && session.staffClubId !== clubId) {
    return { success: false, error: 'No tenés permisos para este club.' }
  }

  try {
    const recurring = await prisma.recurringBooking.findFirst({
      where: { id, clubId },
      select: { id: true },
    })
    if (!recurring) return { success: false, error: 'Turno fijo no encontrado.' }

    const today = argToday()

    await prisma.$transaction(async (tx) => {
      await tx.recurringBooking.update({
        where: { id },
        data: { isActive: false },
      })

      await tx.booking.updateMany({
        where: {
          recurringBookingId: id,
          date: { gte: today },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        data: { status: 'CANCELLED' },
      })
    })

    revalidatePath('/admin/turnos-fijos')
    revalidatePath('/admin/reservas')

    return { success: true }
  } catch (err) {
    console.error('[cancelRecurringBooking]', err)
    return { success: false, error: 'Error al cancelar el turno fijo.' }
  }
}

// ── listRecurringBookings ─────────────────────────────────────────────────

export async function listRecurringBookings(clubId: string) {
  await requireRole(['OWNER', 'STAFF'])

  const today = argToday()

  return prisma.recurringBooking.findMany({
    where: { clubId },
    include: {
      court: { select: { name: true } },
      generatedBookings: {
        where: { date: { gte: today }, status: { in: ['PENDING', 'CONFIRMED'] } },
        select: { id: true },
      },
    },
    orderBy: [{ isActive: 'desc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
}
