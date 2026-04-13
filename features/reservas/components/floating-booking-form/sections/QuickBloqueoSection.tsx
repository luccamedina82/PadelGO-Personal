'use client'

import { getBlockEndOptions } from '../helpers/blockEndOptions'
import { BLOCK_REASON_PRESETS } from '../helpers/constants'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'

interface Props {
  startTime: string
  courtId: string
  blockEndTime: string
  courtSlots: FloatingFormCourtSlots[]
  baseEnd?: number
  reasonPreset: string
  motivo: string
  isLoadingSlots: boolean
  onBlockEndChange: (t: string) => void
  onReasonPreset: (p: string) => void
  onCustomReason: (v: string) => void
}

export default function QuickBloqueoSection({
  startTime, courtId, blockEndTime, courtSlots, baseEnd,
  reasonPreset, motivo, isLoadingSlots,
  onBlockEndChange, onReasonPreset, onCustomReason,
}: Props) {
  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-150">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Hora fin</p>
        {isLoadingSlots ? (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 w-14 rounded-lg bg-surface animate-pulse" />)}
          </div>
        ) : (() => {
          const opts = getBlockEndOptions(startTime, courtId, courtSlots, baseEnd)
          return opts.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {opts.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onBlockEndChange(t)}
                  className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-mono font-semibold cursor-pointer transition-all active:scale-95 ${
                    blockEndTime === t
                      ? 'bg-accent border-accent text-accent-text'
                      : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted/50">No hay opciones disponibles</p>
          )
        })()}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
          Motivo <span className="font-normal text-muted/60 normal-case tracking-normal">(opcional)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_REASON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onReasonPreset(preset)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all active:scale-95 ${
                reasonPreset === preset
                  ? 'bg-accent border-accent text-accent-text'
                  : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
              }`}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onReasonPreset('__custom__')}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all active:scale-95 ${
              reasonPreset === '__custom__'
                ? 'bg-accent border-accent text-accent-text'
                : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
            }`}
          >
            Otro...
          </button>
        </div>
        {reasonPreset === '__custom__' && (
          <input
            type="text"
            placeholder="Escribí el motivo..."
            value={motivo}
            onChange={(e) => onCustomReason(e.target.value)}
            className="mt-2 w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent animate-in fade-in slide-in-from-bottom-1 duration-150"
          />
        )}
      </div>
    </div>
  )
}
