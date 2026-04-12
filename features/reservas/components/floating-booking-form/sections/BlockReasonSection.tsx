'use client'

import { forwardRef, useRef, useEffect } from 'react'
import { BLOCK_REASON_PRESETS } from '../helpers/constants'
import SectionWrapper from './SectionWrapper'

interface BlockReasonSectionProps {
  stepNumber: number
  isComplete: boolean
  isVisible: boolean
  motivo: string
  reasonPreset: string
  isPending: boolean
  onPresetSelect: (preset: string) => void
  onCustomChange: (val: string) => void
}

const inputCls =
  'w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent font-[inherit] placeholder:text-muted'
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

const BlockReasonSection = forwardRef<HTMLButtonElement, BlockReasonSectionProps>(
  function BlockReasonSection({ stepNumber, isComplete, isVisible, motivo, reasonPreset, isPending, onPresetSelect, onCustomChange }, ref) {
    const customInputRef = useRef<HTMLInputElement>(null)
    const showCustomInput = reasonPreset === '__custom__'

    useEffect(() => {
      if (showCustomInput) customInputRef.current?.focus()
    }, [showCustomInput])

    return (
      <SectionWrapper stepNumber={stepNumber} label="Motivo (opcional)" isComplete={isComplete} isVisible={isVisible}>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {BLOCK_REASON_PRESETS.map((preset, idx) => (
            <button
              key={preset}
              ref={idx === 0 ? ref : undefined}
              type="button"
              onClick={() => onPresetSelect(preset)}
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
            onClick={() => onPresetSelect('__custom__')}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all active:scale-95 ${
              showCustomInput
                ? 'bg-accent border-accent text-accent-text'
                : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
            }`}
          >
            Otro...
          </button>
        </div>
        {showCustomInput && (
          <input
            ref={customInputRef}
            type="text"
            placeholder="Escribí el motivo..."
            value={reasonPreset === '__custom__' ? motivo : ''}
            onChange={(e) => onCustomChange(e.target.value)}
            disabled={isPending}
            className={`${inputCls} ${ring} animate-in fade-in slide-in-from-bottom-1 duration-150`}
          />
        )}
      </SectionWrapper>
    )
  },
)

export default BlockReasonSection
