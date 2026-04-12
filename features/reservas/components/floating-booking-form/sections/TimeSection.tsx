'use client'

import { forwardRef, useMemo, useState } from 'react'
import SectionWrapper from './SectionWrapper'

interface TimeSectionProps {
  stepNumber: number
  isComplete: boolean
  isVisible: boolean
  isLoading: boolean
  visibleTimes: string[]
  selectedTime: string
  /** All times that appear in any court slot (operative hours, even if occupied) */
  allGridTimes: Set<string>
  onSelectTime: (time: string) => void
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const TimeSection = forwardRef<HTMLButtonElement, TimeSectionProps>(
  function TimeSection(
    { stepNumber, isComplete, isVisible, isLoading, visibleTimes, selectedTime, allGridTimes, onSelectTime },
    ref,
  ) {
    const [showAll, setShowAll] = useState(false)

    // OOB = times not in the server's grid at all (outside operating hours)
    const oobTimes = useMemo(() => {
      if (allGridTimes.size === 0) return []
      const times: string[] = []
      for (let t = 0; t < 24 * 60; t += 30) {
        const str = minutesToTime(t)
        if (!allGridTimes.has(str)) times.push(str)
      }
      return times
    }, [allGridTimes])

    const hasOobTimes = oobTimes.length > 0

    return (
      <SectionWrapper stepNumber={stepNumber} label="Hora de inicio" isComplete={isComplete} isVisible={isVisible}>
        {isLoading ? (
          <div className="flex gap-1.5 flex-wrap">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-8 w-14 rounded-lg bg-surface animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {visibleTimes.length === 0 && !showAll && (
              <p className="text-xs text-muted py-3 w-full text-center">Sin disponibilidad</p>
            )}
            {visibleTimes.map((t, idx) => (
              <button
                key={t}
                ref={idx === 0 ? ref : undefined}
                type="button"
                onClick={() => onSelectTime(t)}
                className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-mono font-semibold cursor-pointer transition-all active:scale-95 ${
                  selectedTime === t
                    ? 'bg-accent border-accent text-accent-text'
                    : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                }`}
              >
                {t}
              </button>
            ))}
            {showAll &&
              oobTimes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSelectTime(t)}
                  title="Fuera del horario operativo"
                  className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-mono font-semibold cursor-pointer transition-all active:scale-95 ${
                    selectedTime === t
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'border-amber-500/30 bg-card text-amber-500/70 hover:border-amber-400/60 hover:text-amber-400'
                  }`}
                >
                  {t}
                </button>
              ))}
          </div>
        )}
        {!isLoading && hasOobTimes && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-1.5 text-[11px] text-muted hover:text-text font-semibold transition-colors"
          >
            {showAll ? '↑ Ocultar horarios no operativos' : '↓ Mostrar todos los horarios'}
          </button>
        )}
      </SectionWrapper>
    )
  },
)

export default TimeSection
