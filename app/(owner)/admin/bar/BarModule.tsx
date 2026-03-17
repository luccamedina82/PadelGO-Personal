'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/types'
import BestSellingReport from './BestSellingReport'
import StockEntriesTab from './StockEntriesTab'

// ── TYPES ─────────────────────────────────────────────────────────────────

export interface BarProduct {
  id: string
  name: string
  category: string
  price: number // centavos
  stock: number
  minStock: number
  emoji: string
  active: boolean
}

export interface BarSaleRecord {
  id: string
  total: number // centavos
  payMethod: string
  createdAt: string // ISO string
  items: Array<{ productName: string; qty: number; unitPrice: number }>
}

interface BarModuleProps {
  clubId: string
  products: BarProduct[]
  sales: BarSaleRecord[]
  role: string
  pageCount?: number
  currentPage?: number
  createBarSaleAction: (input: {
    clubId: string
    items: Array<{ productId: string; qty: number }>
    payMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'POSNET'
  }) => Promise<ActionResult<{ saleId: string }>>
  createBarProductAction: (input: {
    clubId: string
    name: string
    category: 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO'
    price: number
    stock: number
    minStock: number
    emoji: string
  }) => Promise<ActionResult<{ productId: string }>>
  updateBarProductAction: (
    productId: string,
    clubId: string,
    data: {
      name?: string
      category?: 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO'
      price?: number
      stock?: number
      minStock?: number
      emoji?: string
    }
  ) => Promise<ActionResult>
  toggleBarProductAction: (productId: string, clubId: string) => Promise<ActionResult>
  createBarStockEntryAction?: (input: {
    clubId: string
    productId: string
    qty: number
    reason: string
  }) => Promise<ActionResult<{ entryId: string }>>
}

type Tab = 'caja' | 'inventario' | 'historial' | 'reportes' | 'stock-entries'
type PayMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'POSNET'

function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(centavos / 100)
}

const CATEGORY_LABELS: Record<string, string> = {
  BEBIDAS: 'Bebidas',
  COMIDAS: 'Comidas',
  SNACKS: 'Snacks',
  DEPORTIVO: 'Deportivo',
}

// ── CAJA TAB ──────────────────────────────────────────────────────────────

interface CajaTabProps {
  products: BarProduct[]
  clubId: string
  createBarSaleAction: BarModuleProps['createBarSaleAction']
  onSuccess: () => void
}

function CajaTab({ products, clubId, createBarSaleAction, onSuccess }: CajaTabProps) {
  const [ticket, setTicket] = useState<Record<string, number>>({}) // productId -> qty
  const [payMethod, setPayMethod] = useState<PayMethod>('EFECTIVO')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeProducts = products.filter((p) => p.active)

  function addToTicket(productId: string) {
    setTicket((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }))
  }

  function adjustQty(productId: string, delta: number) {
    setTicket((prev) => {
      const next = (prev[productId] ?? 0) + delta
      if (next <= 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [productId]: next }
    })
  }

  const ticketItems = Object.entries(ticket)
    .map(([productId, qty]) => {
      const product = products.find((p) => p.id === productId)
      if (!product) return null
      return { productId, qty, product }
    })
    .filter(Boolean) as Array<{ productId: string; qty: number; product: BarProduct }>

  const total = ticketItems.reduce((s, i) => s + i.product.price * i.qty, 0)

  function handleSubmit() {
    if (ticketItems.length === 0) return
    setError(null)
    startTransition(async () => {
      const result = await createBarSaleAction({
        clubId,
        items: ticketItems.map((i) => ({ productId: i.productId, qty: i.qty })),
        payMethod,
      })
      if (result.success) {
        setTicket({})
        onSuccess()
      } else {
        setError(result.error ?? 'Error al registrar la venta.')
      }
    })
  }

  const categories = Array.from(new Set(activeProducts.map((p) => p.category)))

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Product grid */}
      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => (
          <div key={cat} className="mb-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {activeProducts
                .filter((p) => p.category === cat)
                .map((product) => {
                  const inTicket = ticket[product.id] ?? 0
                  const outOfStock = product.stock <= 0
                  const lowStock = product.stock > 0 && product.stock <= product.minStock
                  return (
                    <button
                      key={product.id}
                      onClick={() => !outOfStock && addToTicket(product.id)}
                      disabled={outOfStock}
                      className={`relative flex flex-col items-center p-2.5 rounded-xl border text-center transition-colors ${
                        outOfStock
                          ? 'border-border bg-card/50 opacity-50 cursor-not-allowed'
                          : inTicket > 0
                            ? 'border-accent bg-accent/5'
                            : 'border-border bg-card hover:border-accent/50'
                      }`}
                    >
                      {inTicket > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent text-accent-text text-[10px] font-bold rounded-full flex items-center justify-center">
                          {inTicket}
                        </div>
                      )}
                      {lowStock && !outOfStock && (
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-orange-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          !
                        </div>
                      )}
                      <span className="text-2xl mb-1">{product.emoji}</span>
                      <p className="text-[10px] font-medium text-text leading-tight truncate w-full">
                        {product.name}
                      </p>
                      <p className="text-[10px] font-mono text-muted mt-0.5">
                        {formatPrice(product.price)}
                      </p>
                      <p
                        className={`text-[9px] mt-0.5 ${lowStock ? 'text-orange-400' : 'text-sub'}`}
                      >
                        Stock: {product.stock}
                      </p>
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
        {activeProducts.length === 0 && (
          <p className="text-sm text-muted text-center py-8">Sin productos activos en el bar.</p>
        )}
      </div>

      {/* Ticket */}
      <div className="w-full md:w-72 shrink-0 bg-card border border-border rounded-xl p-4 flex flex-col">
        <h3 className="font-semibold text-text mb-3 text-sm">Ticket</h3>

        {ticketItems.length === 0 ? (
          <p className="text-xs text-muted text-center py-6 flex-1">
            Tocá un producto para agregarlo al ticket
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 mb-3">
            {ticketItems.map((item) => (
              <div key={item.productId} className="flex items-center gap-2">
                <span className="text-sm">{item.product.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text truncate">{item.product.name}</p>
                  <p className="text-[10px] font-mono text-muted">
                    {formatPrice(item.product.price * item.qty)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjustQty(item.productId, -1)}
                    className="w-5 h-5 rounded bg-border/50 text-text text-xs flex items-center justify-center hover:bg-border"
                  >
                    –
                  </button>
                  <span className="text-xs font-mono w-5 text-center text-text">{item.qty}</span>
                  <button
                    onClick={() => adjustQty(item.productId, 1)}
                    disabled={item.qty >= item.product.stock}
                    className="w-5 h-5 rounded bg-border/50 text-text text-xs flex items-center justify-center hover:bg-border disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-3 mt-auto">
          <div className="flex justify-between mb-3">
            <span className="text-sm font-semibold text-text">Total</span>
            <span className="text-sm font-bold font-mono text-accent">{formatPrice(total)}</span>
          </div>

          {/* Pay method */}
          <div className="flex gap-1 mb-3">
            {(['EFECTIVO', 'POSNET', 'TRANSFERENCIA'] as PayMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                  payMethod === m
                    ? 'bg-accent text-accent-text'
                    : 'bg-border/30 text-muted hover:text-text'
                }`}
              >
                {m === 'EFECTIVO' ? 'Efect.' : m === 'POSNET' ? 'Posnet' : 'Trans.'}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={ticketItems.length === 0 || isPending}
            className="w-full py-2.5 rounded-xl bg-accent text-accent-text font-semibold text-sm disabled:opacity-50 hover:bg-accent-dark transition-colors"
          >
            {isPending ? 'Procesando...' : `Cobrar ${total > 0 ? formatPrice(total) : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── INVENTARIO TAB ────────────────────────────────────────────────────────

interface InventarioTabProps {
  products: BarProduct[]
  clubId: string
  role: string
  createBarProductAction: BarModuleProps['createBarProductAction']
  updateBarProductAction: BarModuleProps['updateBarProductAction']
  toggleBarProductAction: BarModuleProps['toggleBarProductAction']
  onSuccess: () => void
}

function InventarioTab({
  products,
  clubId,
  role,
  createBarProductAction,
  updateBarProductAction,
  toggleBarProductAction,
  onSuccess,
}: InventarioTabProps) {
  const [editing, setEditing] = useState<string | null>(null) // productId or 'new'
  const [form, setForm] = useState({
    name: '',
    category: 'BEBIDAS' as 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO',
    priceARS: '',
    stock: '',
    minStock: '3',
    emoji: '🥤',
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openNew() {
    setEditing('new')
    setForm({ name: '', category: 'BEBIDAS', priceARS: '', stock: '0', minStock: '3', emoji: '🥤' })
    setError(null)
  }

  function openEdit(product: BarProduct) {
    setEditing(product.id)
    setForm({
      name: product.name,
      category: product.category as 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO',
      priceARS: String(product.price / 100),
      stock: String(product.stock),
      minStock: String(product.minStock),
      emoji: product.emoji,
    })
    setError(null)
  }

  function handleSave() {
    setError(null)
    const priceCentavos = Math.round(parseFloat(form.priceARS) * 100)
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    if (isNaN(priceCentavos) || priceCentavos <= 0) return setError('Precio inválido.')

    startTransition(async () => {
      if (editing === 'new') {
        const result = await createBarProductAction({
          clubId,
          name: form.name.trim(),
          category: form.category,
          price: priceCentavos,
          stock: parseInt(form.stock) || 0,
          minStock: parseInt(form.minStock) || 3,
          emoji: form.emoji || '🥤',
        })
        if (result.success) {
          setEditing(null)
          onSuccess()
        } else setError(result.error ?? 'Error')
      } else {
        const result = await updateBarProductAction(editing!, clubId, {
          name: form.name.trim(),
          category: form.category,
          price: priceCentavos,
          stock: parseInt(form.stock) || 0,
          minStock: parseInt(form.minStock) || 3,
          emoji: form.emoji || '🥤',
        })
        if (result.success) {
          setEditing(null)
          onSuccess()
        } else setError(result.error ?? 'Error')
      }
    })
  }

  function handleToggle(productId: string) {
    startTransition(async () => {
      await toggleBarProductAction(productId, clubId)
      onSuccess()
    })
  }

  const isOwner = role === 'OWNER'

  return (
    <div>
      {isOwner && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={openNew}
            className="px-3 py-1.5 bg-accent text-accent-text text-xs font-semibold rounded-lg hover:bg-accent-dark"
          >
            + Nuevo producto
          </button>
        </div>
      )}

      {/* Product list */}
      <div className="space-y-2">
        {products.map((product) => (
          <div
            key={product.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              product.active ? 'bg-card border-border' : 'bg-card/50 border-border/50 opacity-60'
            }`}
          >
            <span className="text-2xl shrink-0">{product.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{product.name}</p>
              <p className="text-xs text-muted">
                {CATEGORY_LABELS[product.category]} · {formatPrice(product.price)} ·{' '}
                <span
                  className={product.stock <= product.minStock ? 'text-orange-400 font-medium' : ''}
                >
                  Stock: {product.stock}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isOwner && (
                <>
                  <button
                    onClick={() => openEdit(product)}
                    className="text-xs text-muted hover:text-text px-2 py-1 rounded-lg border border-border"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggle(product.id)}
                    className={`text-xs px-2 py-1 rounded-lg border ${
                      product.active
                        ? 'border-border text-muted hover:text-red-400 hover:border-red-400/30'
                        : 'border-accent/30 text-accent hover:bg-accent/5'
                    }`}
                  >
                    {product.active ? 'Desac.' : 'Activar'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-muted text-center py-8">Sin productos configurados.</p>
        )}
      </div>

      {/* Edit/create modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm bg-surface rounded-2xl border border-border p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text">
                {editing === 'new' ? 'Nuevo producto' : 'Editar producto'}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-muted hover:text-text text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted block mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted block mb-1">Emoji</label>
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO',
                    }))
                  }
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted block mb-1">Precio ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.priceARS}
                    onChange={(e) => setForm((f) => ({ ...f, priceARS: e.target.value }))}
                    className="w-full bg-card border border-border rounded-lg px-2 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    className="w-full bg-card border border-border rounded-lg px-2 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Min stock</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minStock}
                    onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
                    className="w-full bg-card border border-border rounded-lg px-2 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 rounded-xl border border-border text-text text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 py-2 rounded-xl bg-accent text-accent-text text-sm font-semibold disabled:opacity-50"
              >
                {isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── HISTORIAL TAB ─────────────────────────────────────────────────────────

function HistorialTab({ sales }: { sales: BarSaleRecord[] }) {
  const PAY_LABELS: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    POSNET: 'Posnet',
    TRANSFERENCIA: 'Transferencia',
  }

  const totalHoy = sales.reduce((s, sale) => s + sale.total, 0)

  return (
    <div>
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 mb-4 flex justify-between items-center">
        <span className="text-sm text-muted">Total del día</span>
        <span className="text-sm font-bold font-mono text-accent">{formatPrice(totalHoy)}</span>
      </div>

      {sales.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">Sin ventas registradas hoy.</p>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <div key={sale.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium text-text font-mono">
                    {formatPrice(sale.total)}
                  </p>
                  <p className="text-xs text-muted">
                    {PAY_LABELS[sale.payMethod] ?? sale.payMethod}
                  </p>
                </div>
                <p className="text-xs text-sub font-mono">
                  {new Date(sale.createdAt).toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="space-y-0.5">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-muted">
                    <span>
                      {item.qty}× {item.productName}
                    </span>
                    <span className="font-mono">{formatPrice(item.unitPrice * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MAIN MODULE ───────────────────────────────────────────────────────────

export default function BarModule({
  clubId,
  products,
  sales,
  role,
  pageCount,
  currentPage,
  createBarSaleAction,
  createBarProductAction,
  updateBarProductAction,
  toggleBarProductAction,
  createBarStockEntryAction,
}: BarModuleProps) {
  const [tab, setTab] = useState<Tab>('caja')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function handleSuccess() {
    setSuccessMsg('Operación exitosa')
    setTimeout(() => setSuccessMsg(null), 2000)
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'caja', label: 'Caja' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'historial', label: 'Historial' },
    { id: 'reportes', label: 'Reportes' },
    { id: 'stock-entries', label: 'Entradas' },
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
        {successMsg && (
          <div className="ml-auto flex items-center px-3 text-xs text-accent font-medium">
            ✓ {successMsg}
          </div>
        )}
      </div>

      {tab === 'caja' && (
        <CajaTab
          products={products}
          clubId={clubId}
          createBarSaleAction={createBarSaleAction}
          onSuccess={handleSuccess}
        />
      )}
      {tab === 'inventario' && (
        <InventarioTab
          products={products}
          clubId={clubId}
          role={role}
          createBarProductAction={createBarProductAction}
          updateBarProductAction={updateBarProductAction}
          toggleBarProductAction={toggleBarProductAction}
          onSuccess={handleSuccess}
        />
      )}
      {tab === 'historial' && <HistorialTab sales={sales} />}
      {tab === 'reportes' && <BestSellingReport sales={sales} products={products} />}
      {tab === 'stock-entries' && createBarStockEntryAction && (
        <StockEntriesTab
          products={products}
          clubId={clubId}
          role={role}
          createBarStockEntryAction={createBarStockEntryAction}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
