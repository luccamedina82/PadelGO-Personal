'use client'

import { forwardRef, type ReactNode } from 'react'

interface SectionWrapperProps {
  stepNumber: number
  label: string
  isComplete: boolean
  isVisible: boolean
  children: ReactNode
}

const SectionWrapper = forwardRef<HTMLDivElement, SectionWrapperProps>(
  function SectionWrapper({ stepNumber, label, isComplete, isVisible, children }, ref) {
    if (!isVisible) return null

    return (
      <div ref={ref} className="animate-in fade-in slide-in-from-bottom-1 duration-150">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
              isComplete
                ? 'bg-green-500/20 text-green-500 scale-100'
                : 'bg-accent text-accent-text'
            }`}
          >
            {isComplete ? '✓' : stepNumber}
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
        </div>
        {children}
      </div>
    )
  },
)

export default SectionWrapper
