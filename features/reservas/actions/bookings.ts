'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/features/auth/actions/auth'
import { getAdminBookingsByDate, getBookingsByDate } from '@/features/reservas/dal/bookings'
import { calcAvailableSlots, calcBookingPrice, resolveBookingRule, timeToMinutes, MIN_ADVANCE_MINUTES } from '@/lib/availability'
import type { BookingRuleInput } from '@/lib/availability'
import { BLOCK_SOURCES } from '@/features/reservas/constants/bookingSources'
import type { PaymentStatus } from '@/app/generated/prisma/enums'
import { argToday, argTodayStr } from '@/lib/date'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
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
  priceOverride?: number // centavos — admin manual override, skips rule resolution
  outOfHoursWarning?: boolean // true cuando se crea fuera del horario operativo (soft constraint aceptado)
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
    priceOverride,
    outOfHoursWarning,
  } = input

  if (!clubId || !courtId || !date || !startTime) {
    return { success: false, error: 'Datos incompletos.' }
  }

  if (durationMinutes <= 0 || durationMinutes > 1440) {
    return { success: false, error: 'Duración inválida.' }
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
      const dayOfWeek = dateObj.getUTCDay()


      const rules = await tx.bookingRule.findMany({
        where: {
          clubId,
          isActive: true,
          daysOfWeek: { has: dayOfWeek },
          OR: [
            { courtIds: { isEmpty: true } }, // Reglas globales del club
            { courtIds: { has: courtId } }   // Reglas específicas de esta cancha
          ],
        },
      })
      if (rules.length === 0) {
        if (bookingType !== 'BLOQUEO') throw new Error('NO_AVAILABILITY')
      }
      // EXCEEDS_CLOSE_TIME is intentionally NOT enforced for OWNER/STAFF manual bookings.
      // Out-of-hours bookings are allowed and tracked via outOfHoursWarning.
      const openTimeMin = rules.length > 0 ? Math.min(...rules.map(r => timeToMinutes(r.startTime))) : 0
      const closeTimeMin = rules.length > 0 ? Math.max(...rules.map(r => timeToMinutes(r.endTime))) : 1440
      
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
      if (bookingType !== 'BLOQUEO' && rules.length > 0) {
        if (priceOverride !== undefined) {
          totalPrice = priceOverride
        } else {
          const baseRulePrice = rules.find(r => r.priority === 0)?.price ?? 0
          const resolved = resolveBookingRule(
            rules as BookingRuleInput[],
            dayOfWeek,
            newStartMin,
            baseRulePrice
          )
          const finalPricePerHour = resolved?.price ?? baseRulePrice
          totalPrice = calcBookingPrice(finalPricePerHour, durationMinutes)
        }
      }

      const bookingUserId = userId ?? session.userId
      const source = (bookingType === 'BLOQUEO' ? 'BLOCK' : 'MANUAL_STAFF') as import('@/app/generated/prisma/client').BookingSource

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
          paymentStatus: 'UNPAID',
          source,
          manualName: bookingType !== 'BLOQUEO' ? (manualName ?? null) : (blockReason ?? 'Bloqueo'),
          manualPhone: bookingType !== 'BLOQUEO' ? (manualPhone ?? null) : null,
          // Auto-flag OOB: frontend hint OR backend detection (past close / before open)
          outOfHoursWarning: (outOfHoursWarning ?? false) || (
            rules.length > 0 && (newEndMin > closeTimeMin || newStartMin < openTimeMin)
          ),
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
    if (err instanceof Error && err.message === 'NO_AVAILABILITY') {
      return { success: false, error: 'La cancha no tiene horario configurado para ese día.' }
    }
    if (err instanceof Error && err.message === 'DURATION_NOT_ALLOWED') {
      return { success: false, error: 'Esa duración no está habilitada para este club.' }
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
  paymentStatus: PaymentStatus
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
  date?: string // YYYY-MM-DD — allows relocation to a different date
  manualName?: string
  manualPhone?: string
  courtId?: string // cross-court drag support
}

export async function updateBooking(
  bookingId: string,
  data: UpdateBookingInput
): Promise<ActionResult> {
  const session = await requireRole(['OWNER', 'STAFF'])

  const { startTime, durationMinutes, manualName, manualPhone, courtId: newCourtId, date: newDateStr } = data

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

      const targetCourtId = newCourtId ?? booking.courtId

      // Verify new court belongs to same club
      if (newCourtId && newCourtId !== booking.courtId) {
        const court = await tx.court.findUnique({ where: { id: newCourtId }, select: { clubId: true } })
        if (!court || court.clubId !== booking.clubId) throw new Error('INVALID_COURT')
      }

      const targetDate = newDateStr
        ? new Date(`${newDateStr}T00:00:00.000Z`)
        : (booking.date as Date)

      const newStartMin = timeToMinutes(startTime)
      const newEndMin = newStartMin + durationMinutes

      // CloseTime check on the target court
      const dayOfWeek = targetDate.getUTCDay()
      const rules = await tx.bookingRule.findMany({
        where: {
          clubId: booking.clubId,
          isActive: true,
          daysOfWeek: { has: dayOfWeek },
          OR: [
            { courtIds: { isEmpty: true } },
            { courtIds: { has: targetCourtId } }
          ],
        },
      })

      // 2. Si no hay reglas, no hay disponibilidad
      if (rules.length === 0) {
        if (booking.source !== 'BLOCK') throw new Error('NO_AVAILABILITY')
      }

      // 3. Verificamos horario de cierre (solo si hay reglas)
      if (rules.length > 0) {
        const closeMin = Math.max(...rules.map(r => timeToMinutes(r.endTime)))
        if (newEndMin > closeMin && booking.source !== 'BLOCK') {
          // Acá podrías decidir si un Admin puede arrastrar fuera de horario o no.
          // En tu versión anterior tiraba error, lo mantenemos:
          throw new Error('EXCEEDS_CLOSE_TIME')
        }

        // Verificamos duración permitida (solo si no es bloqueo)
        if (booking.source !== 'BLOCK') {
          const allAllowedDurations = rules.flatMap(r => r.allowedDurations)
          if (!allAllowedDurations.includes(durationMinutes)) {
            throw new Error('DURATION_NOT_ALLOWED')
          }
        }
      }

      // Conflict check on the target court (excluding self)
      const existing = await tx.booking.findMany({
        where: {
          courtId: targetCourtId,
          date: targetDate,
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
      if (newDateStr) updateData.date = targetDate
      if (newCourtId && newCourtId !== booking.courtId) updateData.courtId = newCourtId
      if (booking.source === 'MANUAL_STAFF') {
        if (manualName !== undefined) updateData.manualName = manualName || null
        if (manualPhone !== undefined) updateData.manualPhone = manualPhone || null
      }

      // Recalculate price when time or court changes
      if (booking.source !== 'BLOCK' && rules.length > 0) {
        const baseRulePrice = rules.find((r) => r.priority === 0)?.price ?? 0
        const resolved = resolveBookingRule(
          rules as BookingRuleInput[],
          dayOfWeek,
          newStartMin,
          baseRulePrice
        )
        const finalPricePerHour = resolved?.price ?? baseRulePrice
        updateData.totalPrice = calcBookingPrice(finalPricePerHour, durationMinutes)
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
      if (err.message === 'EXCEEDS_CLOSE_TIME')
        return { success: false, error: 'La reserva excede el horario de cierre de la cancha.' }
      if (err.message === 'DURATION_NOT_ALLOWED')
        return { success: false, error: 'Esa duración no está habilitada para este club.' }
      if (err.message === 'INVALID_COURT')
        return { success: false, error: 'La cancha no pertenece a este club.' }
      if (err.message === 'NO_AVAILABILITY')
        return { success: false, error: 'La cancha no tiene horario configurado para el nuevo día.' }
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

    if (BLOCK_SOURCES.has(booking.source)) {
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

// ── MONTH AVAILABILITY HEAT-MAP ───────────────────────────────────────────
// Lightweight query: counts available slots per day for a given month.
// Underlying DAL calls (courts + bookings) are already cached, so this
// won't hammer the DB even if the user navigates through months quickly.

export async function getMonthAvailability(
  year: number,
  month: number, // 0-indexed (0 = January)
  clubId: string
): Promise<Record<string, number>> {
  await requireRole(['OWNER', 'STAFF'])

  const todayStr = argTodayStr()
  const now = new Date()

  // Smart range: start = max(today, first day of requested month)
  // end = last day of the NEXT month (so grey overflow days have data too)
  const firstOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const rangeStart = todayStr > firstOfMonth ? todayStr : firstOfMonth
  const endOfNextMonth = new Date(Date.UTC(year, month + 2, 0, 23, 59, 59))

  const rangeStartDate = new Date(`${rangeStart}T00:00:00.000Z`)

  const [{ courts }, bookings, rules] = await Promise.all([
    getCourtsByClubId(clubId),
    getAdminBookingsByDate(clubId, rangeStartDate, endOfNextMonth),
    prisma.bookingRule.findMany({
      where: { clubId, isActive: true },
      select: { 
        name: true,
        priority: true,
        courtIds: true, 
        daysOfWeek: true, 
        startTime: true, 
        endTime: true,
        price: true,
        intervalMinutes: true,
        allowedDurations: true,
        activeFrom: true,
        activeUntil: true
      }
    }),
  ])

  // Group bookings by courtId:date for O(1) lookup
  type BookingEntry = { startTime: string; durationMinutes: number; status: string }
  const bookingsByKey = new Map<string, BookingEntry[]>()
  for (const b of bookings) {
    const key = `${b.courtId}:${b.date}`
    const existing = bookingsByKey.get(key)
    const entry: BookingEntry = { startTime: b.startTime, durationMinutes: b.durationMinutes, status: b.status }
    if (existing) existing.push(entry)
    else bookingsByKey.set(key, [entry])
  }

  const result: Record<string, number> = {}

  // Iterate from rangeStart to end of next month
  const cursor = new Date(rangeStartDate)
  while (cursor <= endOfNextMonth) {
    const y = cursor.getUTCFullYear()
    const m = cursor.getUTCMonth() + 1
    const d = cursor.getUTCDate()
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = cursor.getUTCDay()
    let count = 0

    const rulesForDay = rules.filter(r => r.daysOfWeek.includes(dow))

    for (const court of courts) {
      const courtRules = rulesForDay.filter(r => r.courtIds.length === 0 || r.courtIds.includes(court.id))
      
      if (courtRules.length === 0) continue
      const openTimeMin = Math.min(...courtRules.map(r => timeToMinutes(r.startTime)))
      const closeTimeMin = Math.max(...courtRules.map(r => timeToMinutes(r.endTime)))

      const courtBookings = bookingsByKey.get(`${court.id}:${dateStr}`) ?? []
      
      const slots = calcAvailableSlots(
        { 
          openTime: `${String(Math.floor(openTimeMin/60)).padStart(2, '0')}:${String(openTimeMin%60).padStart(2, '0')}`, 
          closeTime: `${String(Math.floor(closeTimeMin/60)).padStart(2, '0')}:${String(closeTimeMin%60).padStart(2, '0')}`,
          pricePerHour: 0,
          rules: courtRules
        },
        courtBookings,
        cursor,
        now,
        dateStr === todayStr ? MIN_ADVANCE_MINUTES : 0
      )
      count += slots.filter((s) => s.available).length
    }

    result[dateStr] = count
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
}

// ── FETCH BOOKINGS (client-callable wrapper) ─────────────────────────────
// Server Action wrapper so Client Components (React Query queryFn) can
// call the cached DAL function getAdminBookingsByDate.

export async function fetchBookingsAction(
  clubId: string,
  startDateStr: string,
  endDateStr: string
) {
  if (!startDateStr || !endDateStr) return []
  const startDate = new Date(`${startDateStr}T00:00:00.000Z`)
  const endDate = new Date(`${endDateStr}T23:59:59.999Z`)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return []
  return getAdminBookingsByDate(clubId, startDate, endDate)
}




export async function fetchBookingsByDateAction(
  clubId: string,
  dateStr: string
) {
  if (!dateStr) return []
  const startDate = new Date(`${dateStr}T00:00:00.000Z`)
  const endDate = new Date(`${dateStr}T23:59:59.999Z`)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return []
  return getBookingsByDate(clubId, startDate, endDate)
}
