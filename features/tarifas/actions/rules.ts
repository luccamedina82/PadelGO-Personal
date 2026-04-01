'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { getAdminContext } from '@/lib/dal/admin'
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
}

function invalidate(clubId: string) {
  revalidateTag(`rules-${clubId}`, 'default')
  revalidatePath('/admin/tarifas')
}

export async function createRule(data: RuleInput): Promise<ActionResult<{ id: string }>> {
  const { club } = await getAdminContext(['OWNER'])
  if (!club) return { success: false, error: 'Club no encontrado.' }

  if (data.priority === 0) {
    return { success: false, error: 'No se pueden crear múltiples reglas base. Usá prioridad 1 o superior para nuevas reglas.' }
  }
  if (!data.name.trim()) return { success: false, error: 'El nombre es obligatorio.' }
  if (data.daysOfWeek.length === 0) return { success: false, error: 'Seleccioná al menos un día.' }
  if (data.allowedDurations.length === 0) return { success: false, error: 'Seleccioná al menos una duración.' }

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
      },
      select: { id: true },
    })
    invalidate(club.id)
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
