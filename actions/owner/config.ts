'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import type { ActionResult } from '@/types'

export interface UpdateClubConfigInput {
  clubId: string
  name?: string
  description?: string
  vibe?: string
  address?: string
  phone?: string
  email?: string
  amenities?: string[]
  tags?: string[]
  cancelHoursBeforeStart?: number
  cancellationFeePercent?: number
}

export async function updateClubConfig(input: UpdateClubConfigInput): Promise<ActionResult> {
  await requireRole(['OWNER'])

  const {
    clubId,
    name,
    description,
    vibe,
    address,
    phone,
    email,
    amenities,
    tags,
    cancelHoursBeforeStart,
    cancellationFeePercent,
  } = input

  if (!clubId) return { success: false, error: 'Club no especificado.' }
  if (name !== undefined && !name.trim()) {
    return { success: false, error: 'El nombre no puede estar vacío.' }
  }
  if (
    cancelHoursBeforeStart !== undefined &&
    (cancelHoursBeforeStart < 0 || cancelHoursBeforeStart > 48)
  ) {
    return { success: false, error: 'Las horas de cancelación deben estar entre 0 y 48.' }
  }
  if (
    cancellationFeePercent !== undefined &&
    (cancellationFeePercent < 0 || cancellationFeePercent > 100)
  ) {
    return { success: false, error: 'El cargo de cancelación debe estar entre 0% y 100%.' }
  }
  try {
    await prisma.club.update({
      where: { id: clubId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(vibe !== undefined && { vibe }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(amenities !== undefined && { amenities }),
        ...(tags !== undefined && { tags }),
        ...(cancelHoursBeforeStart !== undefined && { cancelHoursBeforeStart }),
        ...(cancellationFeePercent !== undefined && { cancellationFeePercent }),
      },
    })
    revalidatePath('/admin/config')
    revalidatePath('/admin')
    revalidatePath('/admin/reservas')
    revalidatePath(`/club/${clubId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateClubConfig]', err)
    return { success: false, error: 'Error al guardar la configuración.' }
  }
}
