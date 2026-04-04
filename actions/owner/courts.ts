'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import type { ActionResult } from '@/types'

export interface CreateCourtInput {
  clubId: string
  name: string
  type: 'CRISTAL' | 'MURO' | 'PANORAMICA'
  covered: boolean
}

export interface UpdateCourtInput {
  name?: string
  type?: 'CRISTAL' | 'MURO' | 'PANORAMICA'
  covered?: boolean
}


export async function createCourt(
  input: CreateCourtInput
): Promise<ActionResult<{ courtId: string }>> {
  await requireRole(['OWNER'])

  if (!input.name?.trim()) {
    return { success: false, error: 'El nombre de la cancha es obligatorio.' }
  }

  try {
    const court = await prisma.court.create({
      data: {
        clubId: input.clubId,
        name: input.name.trim(),
        type: input.type,
        covered: input.covered,
        svgX: 0,
        svgY: 0,
        svgW: 100,
        svgH: 180,
        isActive: true,
        isUnderMaintenance: false,
      },
      select: { id: true },
    })
    revalidateTag(`courts-${input.clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin')
    revalidatePath('/admin/reservas')
    return { success: true, data: { courtId: court.id } }
  } catch (err) {
    console.error('[createCourt]', err)
    return { success: false, error: 'Error al crear la cancha.' }
  }
}

export async function updateCourt(
  courtId: string,
  clubId: string,
  data: UpdateCourtInput
): Promise<ActionResult> {
  await requireRole(['OWNER'])

  try {
    await prisma.court.update({
      where: { id: courtId, clubId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.covered !== undefined && { covered: data.covered }),
      },
    })
    revalidateTag(`courts-${clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin')
    revalidatePath('/admin/reservas')
    return { success: true }
  } catch (err) {
    console.error('[updateCourt]', err)
    return { success: false, error: 'Error al actualizar la cancha.' }
  }
}

export async function setCourtMaintenance(
  courtId: string,
  clubId: string,
  isUnderMaintenance: boolean
): Promise<ActionResult> {
  await requireRole(['OWNER', 'STAFF'])

  try {
    await prisma.court.update({
      where: { id: courtId, clubId },
      data: { isUnderMaintenance },
    })
    revalidateTag(`courts-${clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[setCourtMaintenance]', err)
    return { success: false, error: 'Error al cambiar estado de la cancha.' }
  }
}

export async function getCourtPendingCount(
  courtId: string
): Promise<ActionResult<{ count: number }>> {
  await requireRole(['OWNER', 'STAFF'])

  try {
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)
    const count = await prisma.booking.count({
      where: {
        courtId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        date: { gte: todayUTC },
      },
    })
    return { success: true, data: { count } }
  } catch (err) {
    console.error('[getCourtPendingCount]', err)
    return { success: false, error: 'Error al contar reservas.' }
  }
}

export async function toggleCourtGridVisibility(
  courtId: string,
  clubId: string
): Promise<ActionResult> {
  await requireRole(['OWNER'])

  try {
    const court = await prisma.court.findUnique({
      where: { id: courtId, clubId },
      select: { hideFromGrid: true },
    })
    if (!court) return { success: false, error: 'Cancha no encontrada.' }

    await prisma.court.update({
      where: { id: courtId },
      data: { hideFromGrid: !court.hideFromGrid },
    })
    revalidateTag(`courts-${clubId}`, 'default')
    revalidateTag(`bookings-${clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin/reservas')
    return { success: true }
  } catch (err) {
    console.error('[toggleCourtGridVisibility]', err)
    return { success: false, error: 'Error al actualizar la visibilidad.' }
  }
}

export async function deactivateCourtAction(
  courtId: string,
  clubId: string
): Promise<ActionResult> {
  await requireRole(['OWNER'])

  try {
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)
    const futureCount = await prisma.booking.count({
      where: {
        courtId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        date: { gte: todayUTC },
      },
    })
    if (futureCount > 0) {
      return {
        success: false,
        error: `Esta cancha tiene ${futureCount} reserva${futureCount !== 1 ? 's' : ''} futura${futureCount !== 1 ? 's' : ''} activa${futureCount !== 1 ? 's' : ''}. Reubicá o cancelá esas reservas antes de desactivarla.`,
      }
    }

    await prisma.court.update({
      where: { id: courtId, clubId },
      data: { isActive: false },
    })
    revalidateTag(`courts-${clubId}`, 'default')
    revalidateTag(`bookings-${clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[deactivateCourtAction]', err)
    return { success: false, error: 'Error al desactivar la cancha.' }
  }
}

export async function activateCourtAction(
  courtId: string,
  clubId: string
): Promise<ActionResult> {
  await requireRole(['OWNER'])

  try {
    await prisma.court.update({
      where: { id: courtId, clubId },
      data: { isActive: true },
    })
    revalidateTag(`courts-${clubId}`, 'default')
    revalidateTag(`bookings-${clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[activateCourtAction]', err)
    return { success: false, error: 'Error al activar la cancha.' }
  }
}
