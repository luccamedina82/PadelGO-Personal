import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import BarModule from './BarModule'
import {
  createBarSale,
  createBarProduct,
  updateBarProduct,
  toggleBarProduct,
} from '@/actions/owner/bar'
import { addBarStockEntry } from '@/actions/owner/bar-stock'
import { argTomorrow, argDaysAgo } from '@/lib/date'

type PageProps = {
  searchParams: Promise<{ start?: string; end?: string; page?: string; limit?: string }>
}

export default async function BarPage({ searchParams }: PageProps) {
  const { start, end, page = '1', limit = '20' } = await searchParams

  const session = await requireRole(['OWNER', 'STAFF'])

  const club =
    session.role === 'STAFF'
      ? await prisma.club.findUnique({
          where: { id: session.staffClubId ?? '' },
          select: { id: true, name: true },
        })
      : await prisma.club.findFirst({
          where: { ownerId: session.userId },
          select: { id: true, name: true },
        })

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  // Date range: default to last 30 days if not provided
  const startDate = start ? new Date(`${start}T00:00:00.000Z`) : argDaysAgo(30)
  const endDate = end ? new Date(`${end}T23:59:59.999Z`) : argTomorrow()

  const pageNum = parseInt(page) || 1
  const pageSize = parseInt(limit) || 20
  const skip = (pageNum - 1) * pageSize

  const [products, rawSales, totalSales] = await Promise.all([
    prisma.barProduct.findMany({
      where: { clubId: club.id },
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
    }),
    prisma.barSale.findMany({
      where: {
        clubId: club.id,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        total: true,
        payMethod: true,
        createdAt: true,
        items: {
          select: {
            qty: true,
            unitPrice: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    prisma.barSale.count({
      where: {
        clubId: club.id,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
  ])

  const sales = rawSales.map((s) => ({
    id: s.id,
    total: s.total,
    payMethod: s.payMethod,
    createdAt: s.createdAt.toISOString(),
    items: s.items.map((i) => ({
      productName: i.product.name,
      qty: i.qty,
      unitPrice: i.unitPrice,
    })),
  }))

  const pageCount = Math.ceil(totalSales / pageSize)

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <h1 className="font-semibold text-text">Bar — {club.name}</h1>
        <p className="text-xs text-muted">
          {products.filter((p) => p.active).length} productos activos
          {products.some((p) => p.active && p.stock <= p.minStock) && (
            <span className="ml-2 text-orange-400 font-medium">· Stock bajo</span>
          )}
        </p>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <BarModule
          clubId={club.id}
          products={products}
          sales={sales}
          role={session.role}
          pageCount={pageCount}
          currentPage={pageNum}
          createBarSaleAction={createBarSale}
          createBarProductAction={createBarProduct}
          updateBarProductAction={updateBarProduct}
          toggleBarProductAction={toggleBarProduct}
          createBarStockEntryAction={addBarStockEntry}
        />
      </div>
    </div>
  )
}
