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
      },
      select: { id: true },
    })
    revalidateTag(`courts-${input.clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin')
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
    return { success: true }
  } catch (err) {
    console.error('[updateCourt]', err)
    return { success: false, error: 'Error al actualizar la cancha.' }
  }
}

export async function toggleCourt(courtId: string, clubId: string): Promise<ActionResult> {
  await requireRole(['OWNER'])

  try {
    const court = await prisma.court.findUnique({
      where: { id: courtId, clubId },
      select: { isActive: true },
    })
    if (!court) return { success: false, error: 'Cancha no encontrada.' }

    await prisma.court.update({
      where: { id: courtId },
      data: { isActive: !court.isActive },
    })
    revalidateTag(`courts-${clubId}`, 'default')
    revalidatePath('/admin/canchas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[toggleCourt]', err)
    return { success: false, error: 'Error al actualizar la cancha.' }
  }
}
