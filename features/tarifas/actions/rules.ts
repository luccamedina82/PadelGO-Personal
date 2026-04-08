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
  onlineStartTime: string | null
  onlineEndTime: string | null
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

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/**
 * Validaciones para reglas de prioridad > 0 (no-base):
 *   #1 — rango horario dentro del horario operativo de la base
 *   #5 — días son subconjunto de los días de la base
 *   #6 — duraciones son subconjunto de las duraciones de la base
 *   #7 — no hay otra regla activa con misma prioridad, días solapados y franja solapada
 * Retorna el error como string, o null si todo está OK.
 */
async function validateNonBaseRule(
  clubId: string,
  data: { priority: number; daysOfWeek: number[]; startTime: string; endTime: string; allowedDurations: number[] },
  excludeId?: string
): Promise<string | null> {
  const now = new Date()

  const [activeBase, priorityConflict] = await Promise.all([
    // Regla base activa — fuente de verdad de días, horario y duraciones permitidas
    prisma.bookingRule.findFirst({
      where: {
        clubId,
        priority: 0,
        courtIds: { isEmpty: true },
        isActive: true,
        AND: [
          { OR: [{ activeFrom: null }, { activeFrom: { lte: now } }] },
          { OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] },
        ],
      },
      select: { startTime: true, endTime: true, daysOfWeek: true, allowedDurations: true },
    }),
    // Cualquier regla activa con la misma prioridad y días solapados (candidato a conflicto #7)
    prisma.bookingRule.findMany({
      where: {
        clubId,
        priority: data.priority,
        isActive: true,
        daysOfWeek: { hasSome: data.daysOfWeek },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, startTime: true, endTime: true, daysOfWeek: true },
    }),
  ])

  if (activeBase) {
    // #5 — días deben ser subconjunto de la base
    const invalidDays = data.daysOfWeek.filter((d) => !activeBase.daysOfWeek.includes(d))
    if (invalidDays.length > 0) {
      const names = invalidDays.map((d) => DAY_NAMES[d] ?? d).join(', ')
      return `La regla cubre días que la tarifa base no incluye: ${names}. Extendé primero la tarifa base.`
    }

    // #1 — rango horario debe estar dentro del operativo de la base
    if (data.startTime < activeBase.startTime || data.endTime > activeBase.endTime) {
      return `El rango horario debe estar dentro del horario operativo del club (${activeBase.startTime} – ${activeBase.endTime}).`
    }

    // #6 — duraciones deben ser subconjunto de la base
    const invalidDurations = data.allowedDurations.filter((d) => !activeBase.allowedDurations.includes(d))
    if (invalidDurations.length > 0) {
      return 'Las duraciones deben ser opciones de la tarifa base del club.'
    }
  }

  // #7 — conflicto de prioridad: misma prioridad + días solapados + franja horaria solapada
  const aStart = timeToMinutes(data.startTime)
  const aEnd = timeToMinutes(data.endTime)
  for (const rule of priorityConflict) {
    const bStart = timeToMinutes(rule.startTime)
    const bEnd = timeToMinutes(rule.endTime)
    const daysOverlap = data.daysOfWeek.some((d) => rule.daysOfWeek.includes(d))
    const timeOverlap = aStart < bEnd && aEnd > bStart
    if (daysOverlap && timeOverlap) {
      return `Ya existe la regla "${rule.name}" con prioridad ${data.priority} que cubre ese horario. Usá una prioridad diferente o ajustá el rango.`
    }
  }

  return null
}

export async function createRule(data: RuleInput): Promise<RuleActionResult<{ id: string }>> {
  const { club } = await getAdminContext(['OWNER'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  if (!data.name.trim()) return { success: false, error: 'El nombre es obligatorio.' }
  if (data.daysOfWeek.length === 0) return { success: false, error: 'Seleccioná al menos un día.' }
  if (data.allowedDurations.length === 0) return { success: false, error: 'Seleccioná al menos una duración.' }

  const isNewBaseRule = data.priority === 0 && data.courtIds.length === 0

  // Validaciones para reglas no-base (#1 horario, #5 días, #6 duraciones, #7 prioridad)
  if (!isNewBaseRule) {
    const err = await validateNonBaseRule(club.id, data)
    if (err) return { success: false, error: err }
  }

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
              onlineStartTime: data.onlineStartTime,
              onlineEndTime: data.onlineEndTime,
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
            onlineStartTime: data.onlineStartTime,
            onlineEndTime: data.onlineEndTime,
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

  // Non-base rule (onlineStartTime/onlineEndTime se ignoran — solo aplican en la base)
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
        onlineStartTime: null,
        onlineEndTime: null,
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

  // Fetch estado actual para mergear y validar correctamente
  const current = await prisma.bookingRule.findFirst({
    where: { id, clubId: club.id },
    select: { priority: true, courtIds: true, daysOfWeek: true, startTime: true, endTime: true, allowedDurations: true },
  })
  if (!current) return { success: false, error: 'Regla no encontrada.' }

  const isNonBase = current.priority !== 0 || current.courtIds.length > 0
  if (isNonBase) {
    // Mergear estado actual con los campos entrantes para validar el estado final
    const merged = {
      priority:         data.priority         ?? current.priority,
      daysOfWeek:       data.daysOfWeek       ?? current.daysOfWeek,
      startTime:        data.startTime        ?? current.startTime,
      endTime:          data.endTime          ?? current.endTime,
      allowedDurations: data.allowedDurations ?? current.allowedDurations,
    }
    const err = await validateNonBaseRule(club.id, merged, id)
    if (err) return { success: false, error: err }
  } else {
    // Es la regla base — validar que las reglas no-base activas existentes
    // sigan siendo subconjunto del nuevo horario/días/duraciones de la base.
    const newStart        = data.startTime        ?? current.startTime
    const newEnd          = data.endTime          ?? current.endTime
    const newDays         = data.daysOfWeek       ?? current.daysOfWeek
    const newDurations    = data.allowedDurations ?? current.allowedDurations

    const timeChanged      = data.startTime !== undefined || data.endTime !== undefined
    const daysChanged      = data.daysOfWeek !== undefined
    const durationsChanged = data.allowedDurations !== undefined

    if (timeChanged || daysChanged || durationsChanged) {
      const now = new Date()
      const nonBaseRules = await prisma.bookingRule.findMany({
        where: {
          clubId: club.id,
          isActive: true,
          id: { not: id },
          AND: [
            { OR: [{ activeFrom: null }, { activeFrom: { lte: now } }] },
            { OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] },
          ],
          NOT: { priority: 0, courtIds: { isEmpty: true } },
        },
        select: { id: true, name: true, startTime: true, endTime: true, daysOfWeek: true, allowedDurations: true },
      })

      const violations: string[] = []
      // Reglas no-base que necesitan que se les quiten duraciones huérfanas (cascade)
      const rulesToPrune: Array<{ id: string; newDurations: number[] }> = []

      for (const rule of nonBaseRules) {
        if (timeChanged && (rule.startTime < newStart || rule.endTime > newEnd)) {
          violations.push(`"${rule.name}" cubre ${rule.startTime}–${rule.endTime}, fuera del nuevo horario base ${newStart}–${newEnd}`)
        }
        if (daysChanged) {
          const invalidDays = rule.daysOfWeek.filter((d) => !newDays.includes(d))
          if (invalidDays.length > 0) {
            const names = invalidDays.map((d) => DAY_NAMES[d] ?? d).join(', ')
            violations.push(`"${rule.name}" cubre días que la nueva base no incluye: ${names}`)
          }
        }
        // Duraciones: cascade — se quitan automáticamente las huérfanas en lugar de bloquear
        if (durationsChanged) {
          const orphaned = rule.allowedDurations.filter((d) => !newDurations.includes(d))
          if (orphaned.length > 0) {
            const pruned = rule.allowedDurations.filter((d) => newDurations.includes(d))
            rulesToPrune.push({ id: rule.id, newDurations: pruned })
          }
        }
      }

      if (violations.length > 0) {
        return {
          success: false,
          error: `Este cambio rompe las siguientes reglas activas:\n• ${violations.join('\n• ')}\n\nAjustá o desactivá esas reglas primero.`,
        }
      }

      // Aplicar cascade de duraciones después de la validación (se hace dentro del try más abajo)
      // Guardamos las reglas a podар en el scope del bloque siguiente via closure
      if (rulesToPrune.length > 0) {
        // Ejecutamos el cascade antes del return para aprovecharnos del try/catch ya existente
        for (const { id: ruleId, newDurations: pruned } of rulesToPrune) {
          if (pruned.length === 0) {
            // Sin duraciones válidas → desactivar la regla
            await prisma.bookingRule.update({ where: { id: ruleId }, data: { isActive: false } })
          } else {
            await prisma.bookingRule.update({ where: { id: ruleId }, data: { allowedDurations: pruned } })
          }
        }
      }
    }
  }

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
        ...('onlineStartTime' in data && { onlineStartTime: data.onlineStartTime }),
        ...('onlineEndTime' in data && { onlineEndTime: data.onlineEndTime }),
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

  const target = await prisma.bookingRule.findFirst({
    where: { id, clubId: club.id },
    select: { priority: true, courtIds: true, daysOfWeek: true, startTime: true, endTime: true, allowedDurations: true },
  })
  if (!target) return { success: false, error: 'Regla no encontrada.' }

  if (!isActive) {
    if (target.priority === 0 && target.courtIds.length === 0) {
      return {
        success: false,
        error: 'La regla base del club no se puede deshabilitar. Siempre debe haber una tarifa por defecto.',
      }
    }
  } else {
    // Al reactivar una regla no-base, validar que siga siendo compatible con la base actual.
    // Si tiene duraciones huérfanas (ya no están en la base), se hace cascade-prune antes de activar.
    const isNonBase = target.priority !== 0 || target.courtIds.length > 0
    if (isNonBase) {
      const now = new Date()
      const activeBase = await prisma.bookingRule.findFirst({
        where: {
          clubId: club.id, priority: 0, courtIds: { isEmpty: true }, isActive: true,
          AND: [
            { OR: [{ activeFrom: null }, { activeFrom: { lte: now } }] },
            { OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] },
          ],
        },
        select: { allowedDurations: true },
      })

      let durationsToSave = target.allowedDurations
      if (activeBase) {
        const orphaned = target.allowedDurations.filter((d) => !activeBase.allowedDurations.includes(d))
        if (orphaned.length > 0) {
          durationsToSave = target.allowedDurations.filter((d) => activeBase.allowedDurations.includes(d))
          if (durationsToSave.length === 0) {
            return { success: false, error: 'No quedan duraciones válidas en esta regla (todas fueron quitadas de la tarifa base). Editá la regla antes de activarla.' }
          }
        }
      }

      // Validar el resto (horario, días, prioridad)
      const err = await validateNonBaseRule(club.id, {
        priority:         target.priority,
        daysOfWeek:       target.daysOfWeek,
        startTime:        target.startTime,
        endTime:          target.endTime,
        allowedDurations: durationsToSave,
      }, id)
      if (err) return { success: false, error: err }

      if (durationsToSave !== target.allowedDurations) {
        // Guardar durations prunadas + activar en una sola operación
        try {
          await prisma.bookingRule.updateMany({
            where: { id, clubId: club.id },
            data: { isActive: true, allowedDurations: durationsToSave },
          })
          invalidate(club.id)
          return { success: true }
        } catch (err) {
          console.error('[toggleRuleStatus]', err)
          return { success: false, error: 'Error al cambiar el estado.' }
        }
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
