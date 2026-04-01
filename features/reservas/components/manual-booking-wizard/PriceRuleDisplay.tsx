'use client'

import { formatPrice } from '@/lib/availability'

interface PriceRuleDisplayProps {
  appliedRuleName?: string
  basePrice: number // centavos
  overrideEnabled: boolean
  overrideInput: string
  onToggleOverride: () => void
  onChangeOverride: (val: string) => void
}

export function PriceRuleDisplay({
  appliedRuleName,
  basePrice,
  overrideEnabled,
  overrideInput,
  onToggleOverride,
  onChangeOverride,
}: PriceRuleDisplayProps) {
  const overrideCentavos =
    overrideEnabled && overrideInput.trim() !== ''
      ? parseInt(overrideInput, 10) * 100
      : null

  const displayPrice = overrideCentavos !== null ? overrideCentavos : basePrice

  return (
    <div className="rounded-xl border border-border overflow-hidden mt-1">
      <div className="flex items-center justify-between px-4 py-[10px] bg-surface/40 border-b border-border/60">
        <span className="text-xs text-muted">Tarifa aplicada</span>
        <span className="text-[10px] font-semibold px-2.5 py-[3px] rounded-full bg-surface border border-border text-muted tracking-wide">
          {appliedRuleName ?? 'Base'}
        </span>
      </div>

      <div className="flex items-center justify-between px-4 py-[10px] bg-surface/40 border-b border-border/60">
        <span className="text-xs text-muted">Precio total</span>
        <span className={`text-sm font-bold tabular-nums ${overrideEnabled ? 'text-amber-400' : 'text-text'}`}>
          {formatPrice(displayPrice)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-[10px] bg-surface/40">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overrideEnabled}
            onChange={onToggleOverride}
            className="w-3.5 h-3.5 cursor-pointer accent-amber-400"
          />
          <span className="text-xs text-muted">Sobreescribir precio</span>
        </label>

        {overrideEnabled && (
          <div className="flex items-center gap-1.5 animate-wz-fade-in">
            <span className="text-xs text-muted font-mono">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={overrideInput}
              onChange={(e) => onChangeOverride(e.target.value)}
              placeholder="0"
              autoFocus
              className="w-24 bg-bg border border-amber-400/50 rounded-lg px-2 py-1 text-xs font-mono
                         text-amber-400 text-right outline-none focus:border-amber-400
                         placeholder:text-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-muted">pesos</span>
          </div>
        )}
      </div>
    </div>
  )
}
