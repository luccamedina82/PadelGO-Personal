/**
 * lib/bar-analytics.ts
 * Pure calculation functions for bar reports (no Next.js imports)
 */

export interface TopProduct {
  productId: string
  productName: string
  emoji: string
  totalQty: number
  totalRevenue: number // centavos
  percentage: number // % of total sales by revenue
}

export interface LowStockProduct {
  productId: string
  name: string
  emoji: string
  stock: number
  minStock: number
  category: string
  percentRemaining: number // stock/minStock * 100
}

/**
 * Calculate top-selling products by revenue
 * Input: flat array of sale items with product info
 * Returns: top 10 products sorted by revenue
 */
export function calcularProductosVendidos(
  barSaleItems: Array<{
    productId: string
    product: { name: string; emoji: string }
    qty: number
    unitPrice: number
  }>,
  totalRevenue: number
): TopProduct[] {
  // Group items by productId
  const groupedByProduct = barSaleItems.reduce(
    (acc, item) => {
      const key = item.productId
      if (!acc[key]) {
        acc[key] = {
          productId: item.productId,
          productName: item.product.name,
          emoji: item.product.emoji,
          totalQty: 0,
          totalRevenue: 0,
        }
      }
      acc[key].totalQty += item.qty
      acc[key].totalRevenue += item.unitPrice * item.qty
      return acc
    },
    {} as Record<
      string,
      {
        productId: string
        productName: string
        emoji: string
        totalQty: number
        totalRevenue: number
      }
    >
  )

  // Convert to array and calculate percentages
  const products = Object.values(groupedByProduct)
    .map((p) => ({
      ...p,
      percentage: totalRevenue > 0 ? Math.round((p.totalRevenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue) // Sort by revenue desc
    .slice(0, 10) // Top 10

  return products
}

/**
 * Get products with stock below minimum
 * Input: all products
 * Returns: low-stock products sorted by remaining percentage (lowest first)
 */
export function getProductosConStockBajo(
  products: Array<{
    id: string
    name: string
    emoji: string
    stock: number
    minStock: number
    category: string
    active: boolean
  }>
): LowStockProduct[] {
  return products
    .filter((p) => p.active && p.stock <= p.minStock)
    .map((p) => ({
      productId: p.id,
      name: p.name,
      emoji: p.emoji,
      stock: p.stock,
      minStock: p.minStock,
      category: p.category,
      percentRemaining: p.minStock > 0 ? (p.stock / p.minStock) * 100 : 0,
    }))
    .sort((a, b) => a.percentRemaining - b.percentRemaining) // lowest first
}
