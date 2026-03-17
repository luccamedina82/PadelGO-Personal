'use client'

import { useMemo } from 'react'
import { calcularProductosVendidos } from '@/lib/bar-analytics'
import type { BarProduct, BarSaleRecord } from './BarModule'

interface Props {
  sales: BarSaleRecord[]
  products: BarProduct[]
}

function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(centavos / 100)
}

export default function BestSellingReport({ sales, products }: Props) {
  const topProducts = useMemo(() => {
    // Build product map for quick lookup
    const productMap = new Map(products.map((p) => [p.name, p]))

    // Flatten all sale items and match with product details
    const items = sales.flatMap((s) =>
      s.items.map((item: any) => {
        const product = productMap.get(item.productName)
        return {
          productId: product?.id || item.productName,
          product: { name: item.productName, emoji: product?.emoji || '🥤' },
          qty: item.qty,
          unitPrice: item.unitPrice,
        }
      })
    )

    const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0)
    return calcularProductosVendidos(items, totalRevenue)
  }, [sales, products])

  const totalQty = topProducts.reduce((s, p) => s + p.totalQty, 0)
  const totalRevenue = topProducts.reduce((s, p) => s + p.totalRevenue, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Unidades vendidas</p>
          <p className="text-3xl font-bold text-accent">{totalQty}</p>
        </div>
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Ingresos totales</p>
          <p className="text-3xl font-bold text-accent">{formatPrice(totalRevenue)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-3">
          Top 10 Productos
        </p>
        {topProducts.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">Sin ventas en este período.</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((product, idx) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
              >
                <div className="text-lg font-mono text-muted w-6 text-center">{idx + 1}.</div>
                <span className="text-2xl">{product.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{product.productName}</p>
                  <p className="text-xs text-muted">
                    {product.totalQty} unidades · {product.percentage}% del total
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-semibold text-accent">
                    {formatPrice(product.totalRevenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
