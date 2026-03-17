'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import type { ActionResult } from '@/types'

export interface AddBarStockEntryInput {
  clubId: string
  productId: string
  qty: number // positive number
  reason: string // "Compra", "Ajuste", "Daño", etc.
}

/**
 * Register a bar stock entry atomically (C-05 pattern):
 * Creates BarStockEntry + updates BarProduct.stock in one transaction.
 */
export async function addBarStockEntry(
  input: AddBarStockEntryInput
): Promise<ActionResult<{ entryId: string }>> {
  const session = await requireRole(['OWNER', 'STAFF'])
  const { clubId, productId, qty, reason } = input

  if (qty <= 0) {
    return { success: false, error: 'La cantidad debe ser mayor a 0.' }
  }
  if (!reason?.trim()) {
    return { success: false, error: 'El motivo es obligatorio.' }
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      // Verify product exists and belongs to club
      const product = await tx.barProduct.findUnique({
        where: { id: productId, clubId },
        select: { id: true, name: true, stock: true },
      })

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND')
      }

      // Create stock entry
      const newEntry = await tx.barStockEntry.create({
        data: {
          clubId,
          productId,
          qty,
          reason: reason.trim(),
          staffId: session.userId,
        },
        select: { id: true },
      })

      // Update product stock
      await tx.barProduct.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
      })

      return newEntry
    })

    revalidatePath('/admin/bar')
    return { success: true, data: { entryId: entry.id } }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCT_NOT_FOUND')
        return { success: false, error: 'El producto no existe o no pertenece al club.' }
    }
    console.error('[addBarStockEntry]', err)
    return { success: false, error: 'Error al registrar la entrada de stock.' }
  }
}
