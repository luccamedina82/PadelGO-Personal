'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import { calcBookingPrice, timeToMinutes, VALID_DURATIONS } from '@/lib/availability'
import { generateAvatarColor } from '@/lib/auth'
import { argToday } from '@/lib/date'
import type { ActionResult } from '@/types'

// ── INPUT TYPES ───────────────────────────────────────────────────────────

export interface CreateBookingInput {
  clubId: string
  courtId: string
  date: string // "YYYY-MM-DD"
  startTime: string // "HH:MM"
  durationMinutes: number
}

export interface CreateGhostBookingInput extends CreateBookingInput {
  guestName: string
  guestEmail: string
}

// ── SHARED BOOKING VALIDATION ─────────────────────────────────────────────

function validateBookingInput(input: CreateBookingInput): string | null {
  const { clubId, courtId, date, startTime, durationMinutes } = input
  if (!clubId || !courtId || !date || !startTime)
    return 'Datos incompletos. Por favor intentá de nuevo.'
  if (!(VALID_DURATIONS as readonly number[]).includes(durationMinutes))
    return 'Duración no válida. Opciones: 60, 90 o 120 minutos.'
  const dateObj = new Date(`${date}T00:00:00.000Z`)
  if (isNaN(dateObj.getTime())) return 'Fecha inválida.'
  if (dateObj < argToday()) return 'No podés reservar en fechas pasadas.'
  return null
}

// ── INTERNAL HELPER: create booking in an open TX ─────────────────────────

async function insertBooking(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  input: CreateBookingInput
) {
  const { clubId, courtId, date, startTime, durationMinutes } = input
  const dateObj = new Date(`${date}T00:00:00.000Z`)
  const newStartMin = timeToMinutes(startTime)
  const newEndMin = newStartMin + durationMinutes

  // 1. Overlap check (C-05)
  const existing = await tx.booking.findMany({
    where: { courtId, date: dateObj, status: { in: ['PENDING', 'CONFIRMED'] } },
    select: { startTime: true, durationMinutes: true },
  })
  const conflict = existing.some((b) => {
    const bStart = timeToMinutes(b.startTime)
    const bEnd = bStart + b.durationMinutes
    return bStart < newEndMin && bEnd > newStartMin
  })
  if (conflict) throw new Error('SLOT_TAKEN')

  // 2. Price + operating hours
  const dayOfWeek = dateObj.getUTCDay()
  const availability = await tx.courtAvailability.findFirst({
    where: { courtId, dayOfWeek, isActive: true },
    select: { pricePerHour: true, openTime: true, closeTime: true },
  })
  if (!availability) throw new Error('NO_AVAILABILITY')

  const openMin = timeToMinutes(availability.openTime)
  const closeMin = timeToMinutes(availability.closeTime)
  if (newStartMin < openMin || newEndMin > closeMin) throw new Error('OUT_OF_HOURS')

  const totalPrice = calcBookingPrice(availability.pricePerHour, durationMinutes)

  // 3. Create
  return tx.booking.create({
    data: {
      userId,
      clubId,
      courtId,
      date: dateObj,
      startTime,
      durationMinutes,
      playerIds: [userId],
      status: 'PENDING',
      totalPrice,
      paymentStatus: 'UNPAID',
      source: 'ONLINE',
    },
    select: { id: true },
  })
}

// ── createBooking (authenticated) ─────────────────────────────────────────

/**
 * Create an online booking with atomic anti-double-booking protection (C-05).
 */
export async function createBooking(
  input: CreateBookingInput
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireAuth()

  const validationError = validateBookingInput(input)
  if (validationError) return { success: false, error: validationError }

  try {
    const booking = await prisma.$transaction((tx) => insertBooking(tx, session.userId, input))

    revalidateTag(`club-${input.clubId}`, 'default')
    revalidatePath(`/club/${input.clubId}`)
    revalidatePath('/historial')

    return { success: true, data: { bookingId: booking.id } }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'SLOT_TAKEN') return { success: false, error: 'SLOT_TAKEN' }
      if (err.message === 'NO_AVAILABILITY')
        return {
          success: false,
          error: 'El club no tiene disponibilidad configurada para ese día.',
        }
      if (err.message === 'OUT_OF_HOURS')
        return { success: false, error: 'El horario está fuera del rango de apertura del club.' }
    }
    console.error('[createBooking]', err)
    return { success: false, error: 'Error al crear la reserva. Por favor intentá de nuevo.' }
  }
}

// ── createGhostBooking (unauthenticated / guest flow) ─────────────────────

/**
 * Create a booking for a guest user.
 * Finds or creates a ghost account for the given email (C-09 applies: always PLAYER).
 * If a real (non-ghost) account already exists, returns ACCOUNT_EXISTS.
 */
export async function createGhostBooking(
  input: CreateGhostBookingInput
): Promise<ActionResult<{ bookingId: string }>> {
  const { guestName, guestEmail, ...bookingInput } = input

  if (!guestName?.trim()) return { success: false, error: 'El nombre es obligatorio.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))
    return { success: false, error: 'Email inválido.' }

  const validationError = validateBookingInput(bookingInput)
  if (validationError) return { success: false, error: validationError }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Find or create ghost user
      const existingUser = await tx.user.findUnique({
        where: { email: guestEmail.toLowerCase() },
        select: { id: true, isGhost: true },
      })

      if (existingUser && !existingUser.isGhost) {
        throw new Error('ACCOUNT_EXISTS')
      }

      const userId = existingUser
        ? existingUser.id
        : (
            await tx.user.create({
              data: {
                name: guestName.trim(),
                email: guestEmail.toLowerCase(),
                password: '',
                role: 'PLAYER',
                isGhost: true,
                zone: '',
                avatarColor: generateAvatarColor(guestName),
              },
              select: { id: true },
            })
          ).id

      // 2. Create the booking with the ghost user
      return insertBooking(tx, userId, bookingInput)
    })

    revalidateTag(`club-${input.clubId}`, 'default')
    revalidatePath(`/club/${input.clubId}`)

    return { success: true, data: { bookingId: booking.id } }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'ACCOUNT_EXISTS') return { success: false, error: 'ACCOUNT_EXISTS' }
      if (err.message === 'SLOT_TAKEN') return { success: false, error: 'SLOT_TAKEN' }
      if (err.message === 'NO_AVAILABILITY')
        return {
          success: false,
          error: 'El club no tiene disponibilidad configurada para ese día.',
        }
      if (err.message === 'OUT_OF_HOURS')
        return { success: false, error: 'El horario está fuera del rango de apertura del club.' }
    }
    console.error('[createGhostBooking]', err)
    return { success: false, error: 'Error al crear la reserva. Por favor intentá de nuevo.' }
  }
}
