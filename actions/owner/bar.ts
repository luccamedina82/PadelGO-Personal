'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import type { ActionResult } from '@/types'

export interface CreateBarSaleInput {
  clubId: string
  items: Array<{ productId: string; qty: number }>
  payMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'POSNET'
  bookingId?: string
}

export interface CreateBarProductInput {
  clubId: string
  name: string
  category: 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO'
  price: number
  stock: number
  minStock: number
  emoji: string
}

export interface UpdateBarProductInput {
  name?: string
  category?: 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO'
  price?: number
  stock?: number
  minStock?: number
  emoji?: string
}

/**
 * Register a bar sale atomically (C-05 pattern):
 * Creates BarSale + BarSaleItem[] + decrements stock in one transaction.
 * BarSaleItem.unitPrice = price at moment of sale (C-08).
 */
export async function createBarSale(
  input: CreateBarSaleInput
): Promise<ActionResult<{ saleId: string }>> {
  const session = await requireRole(['OWNER', 'STAFF'])
  const { clubId, items, payMethod, bookingId } = input

  if (!clubId || !items?.length) {
    return { success: false, error: 'Datos de venta incompletos.' }
  }
  if (session.role === 'STAFF' && session.staffClubId !== clubId) {
    return { success: false, error: 'No tenés permisos para este club.' }
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const productIds = items.map((i) => i.productId)
      const products = await tx.barProduct.findMany({
        where: { id: { in: productIds }, clubId, active: true },
        select: { id: true, price: true, stock: true, name: true },
      })

      if (products.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND')
      const productMap = new Map(products.map((p) => [p.id, p]))

      let total = 0
      const saleItems: Array<{ productId: string; qty: number; unitPrice: number }> = []

      for (const item of items) {
        const product = productMap.get(item.productId)
        if (!product) throw new Error('PRODUCT_NOT_FOUND')
        if (item.qty <= 0) throw new Error('INVALID_QTY')
        if (product.stock < item.qty) throw new Error(`STOCK_INSUFICIENTE:${product.name}`)
        saleItems.push({ productId: item.productId, qty: item.qty, unitPrice: product.price })
        total += product.price * item.qty
      }

      const newSale = await tx.barSale.create({
        data: {
          clubId,
          staffId: session.userId,
          bookingId: bookingId ?? null,
          total,
          payMethod,
          items: { create: saleItems },
        },
        select: { id: true },
      })

      for (const item of saleItems) {
        await tx.barProduct.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        })
      }

      return newSale
    })

    revalidatePath('/admin/bar')
    return { success: true, data: { saleId: sale.id } }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCT_NOT_FOUND')
        return { success: false, error: 'Uno o más productos no están disponibles.' }
      if (err.message === 'INVALID_QTY') return { success: false, error: 'Cantidad inválida.' }
      if (err.message.startsWith('STOCK_INSUFICIENTE:')) {
        return { success: false, error: `Stock insuficiente para "${err.message.split(':')[1]}".` }
      }
    }
    console.error('[createBarSale]', err)
    return { success: false, error: 'Error al registrar la venta.' }
  }
}

export async function createBarProduct(
  input: CreateBarProductInput
): Promise<ActionResult<{ productId: string }>> {
  await requireRole(['OWNER'])
  if (!input.name?.trim())
    return { success: false, error: 'El nombre del producto es obligatorio.' }
  if (input.price <= 0) return { success: false, error: 'El precio debe ser mayor a 0.' }

  try {
    const product = await prisma.barProduct.create({
      data: {
        clubId: input.clubId,
        name: input.name.trim(),
        category: input.category,
        price: input.price,
        stock: input.stock,
        minStock: input.minStock,
        emoji: input.emoji || '🥤',
        active: true,
      },
      select: { id: true },
    })
    revalidatePath('/admin/bar')
    return { success: true, data: { productId: product.id } }
  } catch (err) {
    console.error('[createBarProduct]', err)
    return { success: false, error: 'Error al crear el producto.' }
  }
}

export async function updateBarProduct(
  productId: string,
  clubId: string,
  data: UpdateBarProductInput
): Promise<ActionResult> {
  await requireRole(['OWNER', 'STAFF'])

  try {
    await prisma.barProduct.update({
      where: { id: productId, clubId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.minStock !== undefined && { minStock: data.minStock }),
        ...(data.emoji !== undefined && { emoji: data.emoji }),
      },
    })
    revalidatePath('/admin/bar')
    return { success: true }
  } catch (err) {
    console.error('[updateBarProduct]', err)
    return { success: false, error: 'Error al actualizar el producto.' }
  }
}

export async function toggleBarProduct(productId: string, clubId: string): Promise<ActionResult> {
  await requireRole(['OWNER'])

  try {
    const product = await prisma.barProduct.findUnique({
      where: { id: productId, clubId },
      select: { active: true },
    })
    if (!product) return { success: false, error: 'Producto no encontrado.' }

    await prisma.barProduct.update({
      where: { id: productId },
      data: { active: !product.active },
    })
    revalidatePath('/admin/bar')
    return { success: true }
  } catch (err) {
    console.error('[toggleBarProduct]', err)
    return { success: false, error: 'Error al actualizar el producto.' }
  }
}
