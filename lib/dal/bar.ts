import { cache } from 'react'
import prisma from '@/lib/prisma'
import { cacheTag } from 'next/cache'
import { cacheLife } from 'next/dist/server/use-cache/cache-life'

// 1. Catálogo de productos (Caché larga)
export async function getCachedBarProducts(clubId: string) {
  'use cache'
  cacheLife('days')
  cacheTag(`bar-products-${clubId}`) // Cuando edites un producto, invalidas este tag

  return prisma.barProduct.findMany({
    where: { clubId },
    orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      stock: true,
      minStock: true,
      emoji: true,
      active: true,
    },
  })
}

// 2. Ventas del bar (Tiempo real, memoizado por request)
export const getBarSalesPeriod = cache(async (clubId: string, startDate: Date, endDate: Date) => {
  return prisma.barSale.findMany({
    where: { clubId, createdAt: { gte: startDate, lte: endDate } },
    select: { createdAt: true, total: true }, // Versión liviana para analytics/dashboard
  })
})


// 3. VENTAS PAGINADAS (Memoización por Request de React)
export const getPaginatedBarSales = cache(
  async (clubId: string, startDate: Date, endDate: Date, skip: number, pageSize: number) => {
    // Ejecutamos la búsqueda y el conteo en paralelo
    const [rawSales, totalSales] = await Promise.all([
      prisma.barSale.findMany({
        where: { clubId, createdAt: { gte: startDate, lte: endDate } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          total: true,
          payMethod: true,
          createdAt: true,
          items: {
            select: { qty: true, unitPrice: true, product: { select: { name: true } } },
          },
        },
      }),
      prisma.barSale.count({
        where: { clubId, createdAt: { gte: startDate, lte: endDate } },
      }),
    ])

    // Movemos tu lógica de mapeo ADENTRO del DAL para que la UI reciba la data lista
    const sales = rawSales.map((s) => ({
      id: s.id,
      total: s.total,
      payMethod: s.payMethod,
      createdAt: s.createdAt.toISOString(), // Listo para enviar al cliente de React
      items: s.items.map((i) => ({
        productName: i.product.name,
        qty: i.qty,
        unitPrice: i.unitPrice,
      })),
    }))

    // Retornamos ambas cosas
    return { sales, totalSales }
  }
)
