'use client'

import { useRef, useState } from 'react'
import { CalendarPopover } from '@/features/reservas/components/ui/CalendarPopover'
import { formatDateFull } from '../helpers/manualBookingWizard.helpers'
import SectionWrapper from './SectionWrapper'

interface DateSectionProps {
  stepNumber: number
  date: string
  isComplete: boolean
  isVisible: boolean
  clubId: string
  onDateChange: (date: string) => void
}

export default function DateSection({ stepNumber, date, isComplete, isVisible, clubId, onDateChange }: DateSectionProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarBtnRef = useRef<HTMLButtonElement>(null)
  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

  return (
    <SectionWrapper stepNumber={stepNumber} label="Fecha" isComplete={isComplete} isVisible={isVisible}>
      <button
        ref={calendarBtnRef}
        type="button"
        onClick={() => setCalendarOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card text-[13px] font-semibold text-text hover:border-border-hover transition-colors ${ring}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="flex-1 text-left capitalize">{formatDateFull(date)}</span>
      </button>
      {calendarOpen && (
        <CalendarPopover
          selectedDate={date}
          onSelect={(d: string) => { onDateChange(d); setCalendarOpen(false) }}
          onClose={() => setCalendarOpen(false)}
          anchorRef={calendarBtnRef}
          clubId={clubId}
        />
      )}
    </SectionWrapper>
  )
}
