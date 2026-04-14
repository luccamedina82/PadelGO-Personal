'use client'

import { useCallback, useEffect, useReducer, useState } from 'react'
import { useRecentClients } from './hooks/useRecentClients'
import { useQueryClient } from '@tanstack/react-query'
import { useFormSections } from './hooks/useFormSections'
import { useBookingDerived } from './hooks/useBookingDerived'
import { useFocusManagement } from './hooks/useFocusManagement'
import { useFormHandlers } from './hooks/useFormHandlers'
import { useSubmitBooking } from './hooks/useSubmitBooking'
import { formReducer } from './helpers/formReducer'
import { PriceRuleDisplay } from './PriceRuleDisplay'
import FormModeToggle from './sections/FormModeToggle'
import QuickSummary from './sections/QuickSummary'
import DurationPickerSection from './sections/DurationPickerSection'
import OobWarning from './sections/OobWarning'
import ClientSection from './sections/ClientSection'
import BlockReasonSection from './sections/BlockReasonSection'
import FormFooter from './sections/FormFooter'
import QuickBloqueoSection from './sections/QuickBloqueoSection'
import FullPickersSection from './sections/FullPickersSection'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { FloatingFormInitialData } from '@/app/(owner)/admin/reservas/BookingsClient'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'
import { useBookingFormStore } from '@/store/useBookingFormStore'

interface Props {
  clubId: string
  courts: CourtColumn[]
  baseStart?: number
  baseEnd?: number
  baseBookingRule?: { startTime: string; endTime: string; price: number | null } | null
  initialData: FloatingFormInitialData
  onClose: () => void
  onCreated: (bookingId?: string) => void
  /** Si se provee, el botón "Editar" en QuickSummary cierra el popover y abre el drawer completo */
  onExpandToDrawer?: () => void
  courtSlots: FloatingFormCourtSlots[]
  globalDurations: number[]
  isLoadingSlots: boolean
  onDateChange: (date: string) => void
}

export default function FloatingBookingFormContent({
  clubId, courts, baseStart, baseEnd, baseBookingRule, initialData, onClose, onCreated, onExpandToDrawer,
  courtSlots, globalDurations, isLoadingSlots, onDateChange,
}: Props) {
  const queryClient = useQueryClient()
  const { recentClients, saveClient } = useRecentClients()

  // ── Form state ─────────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false)
  const [form, dispatch] = useReducer(formReducer, {
    bookingMode: 'RESERVA',
    date: initialData.date,
    courtId: initialData.courtId ?? '',
    startTime: initialData.startTime ?? '',
    duration: initialData.durationMinutes ?? 0,
    clientName: '',
    clientPhone: '',
    noClient: false,
    motivo: '',
    blockEndTime: '',
    oobConfirmed: false,
    priceOverrideEnabled: false,
    priceOverrideInput: '',
    reasonPreset: '',
    error: null,
  })

  // ── Sync live duration to store so BookingGrid ghost resizes ──────────
  const setLiveDuration = useBookingFormStore((s) => s.setLiveDuration)
  useEffect(() => { setLiveDuration(form.duration) }, [form.duration, setLiveDuration])
  useEffect(() => { return () => setLiveDuration(null) }, [setLiveDuration])

  // ── Sections visibility ────────────────────────────────────────────────
  const { sections, activeSection } = useFormSections(form, initialData, isExpanded)
  const isQuick = initialData.mode === 'quick' && !isExpanded
  const showDurationPicker = isQuick && initialData.durationLocked === false && form.bookingMode === 'RESERVA'
  const showQuickBloqueo = isQuick && form.bookingMode === 'BLOQUEO'
  const showPickers = initialData.mode === 'full' || isExpanded
  const getSection = (id: string) => sections.find((s) => s.id === id)!

  // ── Derived values ─────────────────────────────────────────────────────
  const { durationOptions, visibleTimes, allGridTimes, selectedSlot, isOOB, basePrice, courtName, canSubmit } =
    useBookingDerived({ form, dispatch, courtSlots, globalDurations, baseStart, baseEnd, baseBookingRule, courts, isLoadingSlots, showDurationPicker })

  // ── Focus management ───────────────────────────────────────────────────
  const { containerRef, clientNameRef, firstTimeRef, firstCourtRef, firstEndTimeRef, firstReasonRef } =
    useFocusManagement({ activeSection, isQuick, bookingMode: form.bookingMode, initialMode: initialData.mode, isLoadingSlots, visibleTimesLength: visibleTimes.length })

  // ── Handlers ───────────────────────────────────────────────────────────
  const { handleModeChange, handleSelectTime, handleBlockEndTimeChange, handleReasonPreset, handleCustomReason } =
    useFormHandlers({ form, dispatch, courtSlots })

  // ── Submit ─────────────────────────────────────────────────────────────
  const { handleSubmit, isPending } =
    useSubmitBooking({ canSubmit, form, dispatch, clubId, isOOB, basePrice, initialDate: initialData.date, queryClient, onCreated, saveClient })

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Enter' && !e.shiftKey && canSubmit && !isPending) { e.preventDefault(); handleSubmit() }
  }, [onClose, canSubmit, isPending, handleSubmit])

  // ── Step numbers (only count visible sections) ─────────────────────────
  let stepCounter = 0
  const stepFor = (id: string) => {
    const s = getSection(id)
    if (s.isVisible) stepCounter++
    return stepCounter
  }

  return (
    <div ref={containerRef} tabIndex={-1} className="flex flex-col max-h-[85vh] overflow-hidden outline-none" onKeyDown={handleKeyDown}>
      <FormModeToggle mode={form.bookingMode} onModeChange={handleModeChange} onClose={onClose} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 [scrollbar-width:thin]">
        {isQuick && (
          <QuickSummary
            courtName={courtName}
            startTime={form.startTime}
            duration={form.duration}
            date={form.date}
            basePrice={basePrice}
            isLoadingPrice={isLoadingSlots}
            durationLocked={initialData.durationLocked !== false}
            onExpand={onExpandToDrawer ?? (() => setIsExpanded(true))}
          />
        )}

        {showQuickBloqueo && (
          <QuickBloqueoSection
            startTime={form.startTime}
            courtId={form.courtId}
            blockEndTime={form.blockEndTime}
            courtSlots={courtSlots}
            baseEnd={baseEnd}
            reasonPreset={form.reasonPreset}
            motivo={form.motivo}
            isLoadingSlots={isLoadingSlots}
            onBlockEndChange={handleBlockEndTimeChange}
            onReasonPreset={handleReasonPreset}
            onCustomReason={handleCustomReason}
          />
        )}

        {showDurationPicker && (
          <DurationPickerSection
            startTime={form.startTime}
            courtId={form.courtId}
            selectedDuration={form.duration}
            globalDurations={globalDurations}
            availableDurations={durationOptions}
            courtSlots={courtSlots}
            baseEnd={baseEnd}
            isLoading={isLoadingSlots}
            onChange={(d) => dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: form.courtId, duration: d } })}
          />
        )}

        {showPickers && (
          <FullPickersSection
            stepFor={stepFor}
            getSection={getSection}
            firstTimeRef={firstTimeRef}
            firstCourtRef={firstCourtRef}
            firstEndTimeRef={firstEndTimeRef}
            form={form}
            dispatch={dispatch}
            clubId={clubId}
            courts={courts}
            courtSlots={courtSlots}
            durationOptions={durationOptions}
            visibleTimes={visibleTimes}
            allGridTimes={allGridTimes}
            baseEnd={baseEnd}
            isLoadingSlots={isLoadingSlots}
            onDateChange={onDateChange}
            onSelectTime={handleSelectTime}
            onBlockEndTimeChange={handleBlockEndTimeChange}
          />
        )}

        <OobWarning
          isVisible={isOOB}
          confirmed={form.oobConfirmed}
          onToggle={(v) => dispatch({ type: 'SET_FIELD', field: 'oobConfirmed', value: v })}
        />

        {form.bookingMode === 'RESERVA' ? (
          <ClientSection
            ref={clientNameRef}
            stepNumber={isQuick ? 1 : stepFor('clientOrReason')}
            isComplete={getSection('clientOrReason').isComplete}
            isVisible={getSection('clientOrReason').isVisible}
            clientName={form.clientName}
            clientPhone={form.clientPhone}
            noClient={form.noClient}
            isPending={isPending}
            isQuick={isQuick}
            recentClients={recentClients}
            onNameChange={(v) => dispatch({ type: 'SET_FIELD', field: 'clientName', value: v })}
            onPhoneChange={(v) => dispatch({ type: 'SET_FIELD', field: 'clientPhone', value: v })}
            onNoClientToggle={(v) => {
              dispatch({ type: 'SET_FIELD', field: 'noClient', value: v })
              if (v) dispatch({ type: 'SET_FIELD', field: 'clientName', value: '' })
            }}
            onSelectRecent={(name, phone) => {
              dispatch({ type: 'SET_FIELD', field: 'clientName', value: name })
              dispatch({ type: 'SET_FIELD', field: 'clientPhone', value: phone ?? '' })
            }}
          />
        ) : (
          !showQuickBloqueo && getSection('clientOrReason').isVisible && (
            <BlockReasonSection
              ref={firstReasonRef}
              stepNumber={stepFor('clientOrReason')}
              isComplete={getSection('clientOrReason').isComplete}
              isVisible={getSection('clientOrReason').isVisible}
              motivo={form.motivo}
              reasonPreset={form.reasonPreset}
              isPending={isPending}
              onPresetSelect={handleReasonPreset}
              onCustomChange={handleCustomReason}
            />
          )
        )}

        {form.bookingMode === 'RESERVA' && form.courtId && form.duration > 0 && (
          <div className="shrink-0 pt-2 border-t border-border/40">
            <PriceRuleDisplay
              appliedRuleName={isOOB ? 'Regla Base (fuera de horario)' : selectedSlot?.appliedRuleName}
              basePrice={basePrice}
              overrideEnabled={form.priceOverrideEnabled}
              overrideInput={form.priceOverrideInput}
              onToggleOverride={() => {
                dispatch({ type: 'SET_FIELD', field: 'priceOverrideEnabled', value: !form.priceOverrideEnabled })
                dispatch({ type: 'SET_FIELD', field: 'priceOverrideInput', value: '' })
              }}
              onChangeOverride={(val) => dispatch({ type: 'SET_FIELD', field: 'priceOverrideInput', value: val })}
            />
          </div>
        )}
      </div>

      {form.error && (
        <div className="px-4 pb-2 shrink-0 animate-in fade-in duration-150">
          <p className="text-[12px] text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">
            {form.error}
          </p>
        </div>
      )}

      <FormFooter
        canSubmit={canSubmit}
        isPending={isPending}
        bookingMode={form.bookingMode}
        startTime={form.startTime}
        courtId={form.courtId}
        clientName={form.clientName}
        noClient={form.noClient}
        blockEndTime={form.blockEndTime}
        isOOB={isOOB}
        oobConfirmed={form.oobConfirmed}
        onClose={onClose}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
