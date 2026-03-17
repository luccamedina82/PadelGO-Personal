'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/types'
import type { BarProduct } from './BarModule'

interface StockEntriesTabProps {
  products: BarProduct[]
  clubId: string
  role: string
  createBarStockEntryAction: (input: {
    clubId: string
    productId: string
    qty: number
    reason: string
  }) => Promise<ActionResult<{ entryId: string }>>
  onSuccess: () => void
}

export default function StockEntriesTab({
  products,
  clubId,
  role,
  createBarStockEntryAction,
  onSuccess,
}: StockEntriesTabProps) {
  const [form, setForm] = useState({
    productId: '',
    qty: '',
    reason: 'Compra',
  })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const activeProducts = products.filter((p) => p.active)
  const isOwner = role === 'OWNER'

  function handleSubmit() {
    if (!form.productId || !form.qty) return
    const qty = parseInt(form.qty)
    if (qty <= 0) return setError('La cantidad debe ser mayor a 0')

    startTransition(async () => {
      setError(null)
      const result = await createBarStockEntryAction({
        clubId,
        productId: form.productId,
        qty,
        reason: form.reason,
      })
      if (result.success) {
        setForm({ productId: '', qty: '', reason: 'Compra' })
        onSuccess()
      } else {
        setError(result.error ?? 'Error al registrar la entrada')
      }
    })
  }

  if (!isOwner) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">Solo el propietario puede registrar entradas de stock.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-muted block mb-1">Producto *</label>
          <select
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
          >
            <option value="">Seleccionar producto...</option>
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted block mb-1">Cantidad *</label>
            <input
              type="number"
              min="1"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Motivo</label>
            <select
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            >
              <option>Compra</option>
              <option>Ajuste</option>
              <option>Daño</option>
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!form.productId || !form.qty || isPending}
          className="w-full py-2.5 rounded-xl bg-accent text-accent-text font-semibold text-sm disabled:opacity-50 hover:bg-accent-dark transition-colors"
        >
          {isPending ? 'Registrando...' : 'Registrar entrada'}
        </button>
      </div>

      {activeProducts.length === 0 && (
        <p className="text-sm text-muted text-center py-8">Sin productos activos disponibles.</p>
      )}
    </div>
  )
}
