'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import type { ActionResult } from '@/types'

export interface UpdateAvailabilityInput {
  courtId: string
  dayOfWeek: number
  isActive: boolean
  openTime: string
  closeTime: string
  pricePerHour: number
}

export async function updateAvailability(input: UpdateAvailabilityInput): Promise<ActionResult> {
  await requireRole(['OWNER'])

  const { courtId, dayOfWeek, isActive, openTime, closeTime, pricePerHour } = input

  if (!courtId) {
    return { success: false, error: 'Datos incompletos.' }
  }
  if (pricePerHour < 0) {
    return { success: false, error: 'El precio no puede ser negativo.' }
  }

  try {
    const court = await prisma.court.findUnique({ where: { id: courtId }, select: { clubId: true } })

    const existing = await prisma.courtAvailability.findFirst({
      where: { courtId, dayOfWeek },
      select: { id: true },
    })

    if (existing) {
      await prisma.courtAvailability.update({
        where: { id: existing.id },
        data: { isActive, openTime, closeTime, pricePerHour },
      })
    } else {
      await prisma.courtAvailability.create({
        data: { courtId, dayOfWeek, isActive, openTime, closeTime, pricePerHour },
      })
    }

    if (court) revalidateTag(`courts-${court.clubId}`, 'default')
    revalidatePath('/admin/horarios')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[updateAvailability]', err)
    return { success: false, error: 'Error al guardar la disponibilidad.' }
  }
}

/** Bulk upsert: saves ALL rows for a club in a single transaction */
export async function updateClubAvailability(input: {
  clubId: string
  rows: UpdateAvailabilityInput[]
}): Promise<ActionResult> {
  await requireRole(['OWNER'])

  const { clubId, rows } = input

  if (!clubId || !Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'Datos incompletos.' }
  }

  if (rows.some((r) => r.pricePerHour < 0)) {
    return { success: false, error: 'El precio no puede ser negativo.' }
  }

  try {
    const courtIds = [...new Set(rows.map((r) => r.courtId))]
    await prisma.$transaction([
      prisma.courtAvailability.deleteMany({ where: { courtId: { in: courtIds } } }),
      prisma.courtAvailability.createMany({ data: rows }),
    ])

    revalidateTag(`courts-${clubId}`, 'default')
    revalidatePath('/admin/horarios')
    revalidatePath('/admin/reservas')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('[updateClubAvailability]', err)
    return { success: false, error: 'Error al guardar los horarios.' }
  }
}
