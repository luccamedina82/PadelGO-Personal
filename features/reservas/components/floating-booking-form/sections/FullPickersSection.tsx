'use client'

import React from 'react'
import DateSection from './DateSection'
import TimeSection from './TimeSection'
import CourtDurationSection from './CourtDurationSection'
import BlockEndTimeSection from './BlockEndTimeSection'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'
import type { FormState, FormAction } from '../helpers/formReducer'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { SectionState } from '../hooks/useFormSections'

interface Props {
  stepFor: (id: string) => number
  getSection: (id: string) => SectionState
  firstTimeRef: React.RefObject<HTMLButtonElement | null>
  firstCourtRef: React.RefObject<HTMLButtonElement | null>
  firstEndTimeRef: React.RefObject<HTMLButtonElement | null>
  form: FormState
  dispatch: React.Dispatch<FormAction>
  clubId: string
  courts: CourtColumn[]
  courtSlots: FloatingFormCourtSlots[]
  durationOptions: number[]
  visibleTimes: string[]
  allGridTimes: Set<string>
  baseEnd?: number
  isLoadingSlots: boolean
  onDateChange: (d: string) => void
  onSelectTime: (t: string) => void
  onBlockEndTimeChange: (t: string) => void
}

export default function FullPickersSection({
  stepFor, getSection, firstTimeRef, firstCourtRef, firstEndTimeRef,
  form, dispatch, clubId, courts, courtSlots, durationOptions,
  visibleTimes, allGridTimes, baseEnd, isLoadingSlots,
  onDateChange, onSelectTime, onBlockEndTimeChange,
}: Props) {
  return (
    <>
      <DateSection
        stepNumber={stepFor('date')}
        date={form.date}
        isComplete={getSection('date').isComplete}
        isVisible={getSection('date').isVisible}
        clubId={clubId}
        onDateChange={(d) => { dispatch({ type: 'SET_DATE', payload: d }); onDateChange(d) }}
      />
      <TimeSection
        ref={firstTimeRef}
        stepNumber={stepFor('time')}
        isComplete={getSection('time').isComplete}
        isVisible={getSection('time').isVisible}
        isLoading={isLoadingSlots}
        visibleTimes={visibleTimes}
        selectedTime={form.startTime}
        allGridTimes={allGridTimes}
        onSelectTime={onSelectTime}
      />
      <CourtDurationSection
        ref={firstCourtRef}
        stepNumber={stepFor('courtDuration')}
        isComplete={getSection('courtDuration').isComplete}
        isVisible={getSection('courtDuration').isVisible}
        bookingMode={form.bookingMode}
        startTime={form.startTime}
        courtId={form.courtId}
        duration={form.duration}
        courts={courts}
        courtSlots={courtSlots}
        durationOptions={durationOptions}
        baseEnd={baseEnd}
        onCourtDuration={(cId, dur) => dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: cId, duration: dur } })}
      />
      {form.bookingMode === 'BLOQUEO' && (
        <BlockEndTimeSection
          ref={firstEndTimeRef}
          stepNumber={stepFor('blockEndTime')}
          isComplete={getSection('blockEndTime').isComplete}
          isVisible={getSection('blockEndTime').isVisible}
          startTime={form.startTime}
          courtId={form.courtId}
          blockEndTime={form.blockEndTime}
          courtSlots={courtSlots}
          baseEnd={baseEnd}
          onEndTimeChange={onBlockEndTimeChange}
        />
      )}
    </>
  )
}
