'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import type { ActionResult } from '@/types'

export interface CreateSpecialHoursInput {
  clubId: string
  date: string // ISO date (YYYY-MM-DD)
  reason: string
  isClosed: boolean
  openTime?: string // HH:MM
  closeTime?: string // HH:MM
}

export interface DeleteSpecialHoursInput {
  clubId: string
  specialHoursId: string
}

export async function createSpecialHours(input: CreateSpecialHoursInput): Promise<ActionResult> {
  await requireRole(['OWNER'])

  const { clubId, date, reason, isClosed, openTime, closeTime } = input

  if (!clubId) return { success: false, error: 'Club no especificado.' }
  if (!date) return { success: false, error: 'Fecha requerida.' }
  if (!reason.trim()) return { success: false, error: 'Motivo requerido.' }

  // Validar que si no está cerrado, debe tener horarios
  if (!isClosed && (!openTime || !closeTime)) {
    return { success: false, error: 'Debe especificar horarios si el club no está cerrado.' }
  }

  // Validar formato de hora
  if (openTime && !/^\d{2}:\d{2}$/.test(openTime)) {
    return { success: false, error: 'Formato de hora inválido (HH:MM).' }
  }
  if (closeTime && !/^\d{2}:\d{2}$/.test(closeTime)) {
    return { success: false, error: 'Formato de hora inválido (HH:MM).' }
  }

  // Convertir fecha a Date (medianoche UTC)
  const dateObj = new Date(date + 'T00:00:00Z')

  try {
    await prisma.specialHours.create({
      data: {
        clubId,
        date: dateObj,
        reason: reason.trim(),
        isClosed,
        ...(openTime && { openTime }),
        ...(closeTime && { closeTime }),
      },
    })

    revalidatePath('/admin/config')
    return { success: true }
  } catch (err) {
    console.error('[createSpecialHours]', err)
    // Check for unique constraint violation
    if ((err as any).code === 'P2002') {
      return { success: false, error: 'Ya existe una entrada para esta fecha.' }
    }
    return { success: false, error: 'Error al crear horario especial.' }
  }
}

export async function deleteSpecialHours(input: DeleteSpecialHoursInput): Promise<ActionResult> {
  await requireRole(['OWNER'])

  const { clubId, specialHoursId } = input

  if (!clubId || !specialHoursId) {
    return { success: false, error: 'Datos incompletos.' }
  }

  try {
    await prisma.specialHours.delete({
      where: {
        id: specialHoursId,
        clubId, // Validar que pertenece al club del owner
      },
    })

    revalidatePath('/admin/config')
    return { success: true }
  } catch (err) {
    console.error('[deleteSpecialHours]', err)
    return { success: false, error: 'Error al eliminar horario especial.' }
  }
}
