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
import { getAdminContext } from '@/lib/dal/admin'
import { getCachedBarProducts, getPaginatedBarSales } from '@/lib/dal/bar'

type PageProps = {
  searchParams: Promise<{ start?: string; end?: string; page?: string; limit?: string }>
}

export default async function BarPage({ searchParams }: PageProps) {
  const { start, end, page = '1', limit = '20' } = await searchParams

  const {club, session} = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  // Date range: default to last 30 days if not provided
  const startDate = start ? new Date(`${start}T00:00:00.000Z`) : argDaysAgo(30)
  const endDate = end ? new Date(`${end}T23:59:59.999Z`) : argTomorrow()

  const pageNum = parseInt(page) || 1
  const pageSize = parseInt(limit) || 20
  const skip = (pageNum - 1) * pageSize


const [products, { sales, totalSales }] = await Promise.all([
    getCachedBarProducts(club.id),
    getPaginatedBarSales(club.id, startDate, endDate, skip, pageSize)
  ])

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
