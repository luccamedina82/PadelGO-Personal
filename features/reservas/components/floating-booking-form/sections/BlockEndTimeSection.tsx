'use client'

import { forwardRef } from 'react'
import { getBlockEndOptions } from '../helpers/blockEndOptions'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'
import SectionWrapper from './SectionWrapper'

interface BlockEndTimeSectionProps {
  stepNumber: number
  isComplete: boolean
  isVisible: boolean
  startTime: string
  courtId: string
  blockEndTime: string
  courtSlots: FloatingFormCourtSlots[]
  baseEnd?: number
  onEndTimeChange: (endTime: string) => void
}

const BlockEndTimeSection = forwardRef<HTMLButtonElement, BlockEndTimeSectionProps>(
  function BlockEndTimeSection({ stepNumber, isComplete, isVisible, startTime, courtId, blockEndTime, courtSlots, baseEnd, onEndTimeChange }, ref) {
    const endOptions = startTime ? getBlockEndOptions(startTime, courtId, courtSlots, baseEnd) : []

    return (
      <SectionWrapper stepNumber={stepNumber} label="Hora fin" isComplete={isComplete} isVisible={isVisible}>
        {startTime ? (
          <div className="flex flex-wrap gap-1.5">
            {endOptions.map((t, idx) => (
              <button
                key={t}
                ref={idx === 0 ? ref : undefined}
                type="button"
                onClick={() => onEndTimeChange(t)}
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
          <div className="flex items-center px-3 py-2.5 rounded-xl border border-border">
            <span className="text-[13px] font-semibold text-muted/30">Esperando hora de inicio...</span>
          </div>
        )}
      </SectionWrapper>
    )
  },
)

export default BlockEndTimeSection
