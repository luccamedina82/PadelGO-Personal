'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { getAdminContext } from '@/lib/dal/admin'
import { timeToMinutes } from '@/lib/availability'
import type { ActionResult } from '@/types'

export interface RuleInput {
  name: string
  priority: number
  daysOfWeek: number[]
  startTime: string
  endTime: string
  price: number | null
  intervalMinutes: number
  allowedDurations: number[]
  isActive: boolean
  courtIds: string[]
  activeFrom: Date | null
  activeUntil: Date | null
  confirmConflicts?: boolean
}

/** Extended result type: adds a `warning` branch for pre-flight conflicts */
export type RuleActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; warning?: never; error: string }
  | { success: false; warning: true; message: string; conflictCount: number }

function invalidate(clubId: string) {
  revalidateTag(`rules-${clubId}`, 'default')
  revalidatePath('/admin/tarifas')
  revalidatePath('/admin/reservas')
}

export async function createRule(data: RuleInput): Promise<RuleActionResult<{ id: string }>> {
  const { club } = await getAdminContext(['OWNER'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  if (!data.name.trim()) return { success: false, error: 'El nombre es obligatorio.' }
  if (data.daysOfWeek.length === 0) return { success: false, error: 'Seleccioná al menos un día.' }
  if (data.allowedDurations.length === 0) return { success: false, error: 'Seleccioná al menos una duración.' }

  const isNewBaseRule = data.priority === 0 && data.courtIds.length === 0

  if (isNewBaseRule) {
    const now = new Date()
    const effectiveFrom = data.activeFrom ?? now

    // Find the currently active base rule
    const existingActive = await prisma.bookingRule.findFirst({
      where: {
        clubId: club.id,
        priority: 0,
        courtIds: { isEmpty: true },
        AND: [
          { OR: [{ activeFrom: null }, { activeFrom: { lte: now } }] },
          { OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] },
        ],
      },
      select: { id: true },
    })

    if (existingActive) {
      // Pre-flight: check for bookings outside the new time window
      const openMin = timeToMinutes(data.startTime)
      const closeMin = timeToMinutes(data.endTime)

      const futureBookings = await prisma.booking.findMany({
        where: {
          clubId: club.id,
          date: { gte: effectiveFrom },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { startTime: true, durationMinutes: true },
      })

      const conflictCount = futureBookings.filter((b) => {
        const bStart = timeToMinutes(b.startTime)
        const bEnd = bStart + b.durationMinutes
        return bStart < openMin || bEnd > closeMin
      }).length

      if (conflictCount > 0 && !data.confirmConflicts) {
        return {
          success: false,
          warning: true,
          conflictCount,
          message: `Este cambio dejará ${conflictCount} reserva${conflictCount !== 1 ? 's' : ''} fuera del nuevo horario operativo (${data.startTime}–${data.endTime}). ¿Continuar y enviarlas al Centro de Resolución?`,
        }
      }
    }

    try {
      let createdId: string

      if (existingActive && !data.activeFrom) {
        // Immediate activation: retire old rule and create new one atomically.
        // Normalize to UTC midnight so comparisons elsewhere don't drift.
        const todayUtc = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
        const yesterdayEnd = new Date(todayUtc.getTime() - 1) // 23:59:59.999Z yesterday
        const created = await prisma.$transaction(async (tx) => {
          // Retire ALL active base rules (handles zombie state from previous runs)
          await tx.bookingRule.updateMany({
            where: { clubId: club.id, priority: 0, courtIds: { isEmpty: true }, isActive: true },
            data: { activeUntil: yesterdayEnd },
          })
          return tx.bookingRule.create({
            data: {
              clubId: club.id,
              courtIds: [],
              name: data.name.trim(),
              priority: 0,
              daysOfWeek: data.daysOfWeek,
              startTime: data.startTime,
              endTime: data.endTime,
              price: data.price,
              intervalMinutes: data.intervalMinutes,
              allowedDurations: data.allowedDurations,
              isActive: true,
              activeFrom: todayUtc,
              activeUntil: null,
            },
            select: { id: true },
          })
        })
        createdId = created.id
      } else {
        if (existingActive && data.activeFrom) {
          // Scheduled: auto-chain the previous rule
          const chainedUntil = new Date(data.activeFrom.getTime() - 60_000)
          await prisma.bookingRule.update({
            where: { id: existingActive.id },
            data: { activeUntil: chainedUntil },
          })
        }
        const created = await prisma.bookingRule.create({
          data: {
            clubId: club.id,
            courtIds: data.courtIds,
            name: data.name.trim(),
            priority: data.priority,
            daysOfWeek: data.daysOfWeek,
            startTime: data.startTime,
            endTime: data.endTime,
            price: data.price,
            intervalMinutes: data.intervalMinutes,
            allowedDurations: data.allowedDurations,
            isActive: data.isActive,
            activeFrom: data.activeFrom,
            activeUntil: data.activeUntil,
          },
          select: { id: true },
        })
        createdId = created.id
      }

      invalidate(club.id)
      revalidateTag(`bookings-${club.id}`, 'default')
      return { success: true, data: { id: createdId } }
    } catch (err) {
      console.error('[createRule]', err)
      return { success: false, error: 'Error al crear la regla.' }
    }
  }

  // Non-base rule
  try {
    const rule = await prisma.bookingRule.create({
      data: {
        clubId: club.id,
        courtIds: data.courtIds,
        name: data.name.trim(),
        priority: data.priority,
        daysOfWeek: data.daysOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        price: data.price,
        intervalMinutes: data.intervalMinutes,
        allowedDurations: data.allowedDurations,
        isActive: data.isActive,
        activeFrom: data.activeFrom,
        activeUntil: data.activeUntil,
      },
      select: { id: true },
    })
    invalidate(club.id)
    revalidateTag(`bookings-${club.id}`, 'default')
    return { success: true, data: { id: rule.id } }
  } catch (err) {
    console.error('[createRule]', err)
    return { success: false, error: 'Error al crear la regla.' }
  }
}

export async function updateRule(
  id: string,
  data: Partial<RuleInput>
): Promise<ActionResult> {
  const { club } = await getAdminContext(['OWNER'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  try {
    await prisma.bookingRule.updateMany({
      where: { id, clubId: club.id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.daysOfWeek !== undefined && { daysOfWeek: data.daysOfWeek }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...('price' in data && { price: data.price }),
        ...(data.intervalMinutes !== undefined && { intervalMinutes: data.intervalMinutes }),
        ...(data.allowedDurations !== undefined && { allowedDurations: data.allowedDurations }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.courtIds !== undefined && { courtIds: data.courtIds }),
        ...('activeFrom' in data && { activeFrom: data.activeFrom }),
        ...('activeUntil' in data && { activeUntil: data.activeUntil }),
      },
    })
    invalidate(club.id)
    return { success: true }
  } catch (err) {
    console.error('[updateRule]', err)
    return { success: false, error: 'Error al actualizar la regla.' }
  }
}

export async function deleteRule(id: string): Promise<ActionResult> {
  const { club } = await getAdminContext(['OWNER'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  const target = await prisma.bookingRule.findFirst({
    where: { id, clubId: club.id },
    select: { priority: true, courtIds: true },
  })
  if (target?.priority === 0 && target.courtIds.length === 0) {
    return { success: false, error: 'No se puede eliminar la regla base del club.' }
  }

  try {
    await prisma.bookingRule.deleteMany({ where: { id, clubId: club.id } })
    invalidate(club.id)
    return { success: true }
  } catch (err) {
    console.error('[deleteRule]', err)
    return { success: false, error: 'Error al eliminar la regla.' }
  }
}

export async function toggleRuleStatus(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const { club } = await getAdminContext(['OWNER'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  if (!isActive) {
    const target = await prisma.bookingRule.findFirst({
      where: { id, clubId: club.id },
      select: { priority: true, courtIds: true },
    })
    if (target?.priority === 0 && target.courtIds.length === 0) {
      return {
        success: false,
        error: 'La regla base del club no se puede deshabilitar. Siempre debe haber una tarifa por defecto.',
      }
    }
  }

  try {
    await prisma.bookingRule.updateMany({
      where: { id, clubId: club.id },
      data: { isActive },
    })
    invalidate(club.id)
    return { success: true }
  } catch (err) {
    console.error('[toggleRuleStatus]', err)
    return { success: false, error: 'Error al cambiar el estado.' }
  }
}

/** Immediately activate a base rule, retiring the current active one via transaction. */
export async function activateRuleNow(id: string): Promise<ActionResult> {
  const { club } = await getAdminContext(['OWNER'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  const target = await prisma.bookingRule.findFirst({
    where: { id, clubId: club.id, priority: 0, courtIds: { isEmpty: true } },
    select: { id: true },
  })
  if (!target) return { success: false, error: 'Regla no encontrada.' }

  try {
    const now = new Date()
    const todayUtc = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    const yesterdayEnd = new Date(todayUtc.getTime() - 1) // 23:59:59.999Z yesterday
    await prisma.$transaction(async (tx) => {
      // Retire ALL active base rules (handles zombie state regardless of activeFrom time)
      await tx.bookingRule.updateMany({
        where: { clubId: club.id, priority: 0, courtIds: { isEmpty: true }, isActive: true, id: { not: id } },
        data: { activeUntil: yesterdayEnd },
      })
      // Activate the target rule from today's UTC midnight
      await tx.bookingRule.update({
        where: { id },
        data: { activeFrom: todayUtc, activeUntil: null, isActive: true },
      })
    })
    invalidate(club.id)
    revalidateTag(`bookings-${club.id}`, 'default')
    return { success: true }
  } catch (err) {
    console.error('[activateRuleNow]', err)
    return { success: false, error: 'Error al activar la regla.' }
  }
}
