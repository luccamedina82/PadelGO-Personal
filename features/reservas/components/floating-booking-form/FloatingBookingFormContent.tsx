'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from 'react'
import { useRecentClients } from './hooks/useRecentClients'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { calcBookingPrice, timeToMinutes } from '@/lib/availability'
import { getWeekStart } from '@/lib/date'
import { createManualBooking } from '@/features/reservas/actions/bookings'
import {
  getFloatingFormDataAction,
  type FloatingFormCourtSlots,
} from '@/features/reservas/actions/floatingFormData'
import { getAvailableDurationsForCourt, getVisibleTimeSlotsForDate } from './helpers/bookingCalcUtils'
import { computeEndTime, endTimeToMinutes } from './helpers/manualBookingWizard.helpers'
import { formReducer, type BookingMode } from './helpers/formReducer'
import { getBlockEndOptions } from './helpers/blockEndOptions'
import { BLOCK_REASON_PRESETS } from './helpers/constants'
import { useFormSections } from './hooks/useFormSections'
import { PriceRuleDisplay } from './PriceRuleDisplay'
import FormModeToggle from './sections/FormModeToggle'
import QuickSummary from './sections/QuickSummary'
import DurationPickerSection from './sections/DurationPickerSection'
import DateSection from './sections/DateSection'
import TimeSection from './sections/TimeSection'
import CourtDurationSection from './sections/CourtDurationSection'
import BlockEndTimeSection from './sections/BlockEndTimeSection'
import ClientSection from './sections/ClientSection'
import BlockReasonSection from './sections/BlockReasonSection'
import OobWarning from './sections/OobWarning'
import FormFooter from './sections/FormFooter'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { FloatingFormInitialData } from '@/app/(owner)/admin/reservas/BookingsClient'
import type { BookingBlock } from '@/features/reservas/components/booking-grid/types/bookingGrid.types'

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
}

export default function FloatingBookingFormContent({
  clubId, courts, baseStart, baseEnd, baseBookingRule, initialData, onClose, onCreated, onExpandToDrawer,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { recentClients, saveClient } = useRecentClients()

  // ── Refs for focus management ──────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const clientNameRef = useRef<HTMLInputElement>(null)
  const firstTimeRef = useRef<HTMLButtonElement>(null)
  const firstCourtRef = useRef<HTMLButtonElement>(null)
  const firstEndTimeRef = useRef<HTMLButtonElement>(null)
  const firstReasonRef = useRef<HTMLButtonElement>(null)

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

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: floatingData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['floatingData', clubId, form.date],
    queryFn: () => getFloatingFormDataAction(clubId, form.date),
    staleTime: 1000 * 60,
  })
  const courtSlots = floatingData?.courtSlots ?? []
  const globalDurations = floatingData?.durationOptions ?? []

  // ── Derived values ─────────────────────────────────────────────────────
  const durationOptions = useMemo(() => {
    if (form.courtId && form.startTime) {
      const courtData = courtSlots.find((cs) => cs.courtId === form.courtId)
      const slotData = courtData?.slots.find((s) => s.time === form.startTime)
      if (slotData && slotData.durationOptions.length > 0) return slotData.durationOptions
    }
    if (form.startTime) {
      const allAtTime = courtSlots.flatMap((cs) => {
        const s = cs.slots.find((x) => x.time === form.startTime)
        return s?.available ? s.durationOptions : []
      })
      const unique = [...new Set(allAtTime)].sort((a, b) => a - b)
      if (unique.length > 0) return unique
    }
    return globalDurations.length > 0 ? globalDurations : [30, 60, 90, 120]
  }, [form.courtId, form.startTime, courtSlots, globalDurations])
  const visibleTimes = getVisibleTimeSlotsForDate(courtSlots, durationOptions)

  // All times that appear in the grid (operative hours, even if occupied)
  const allGridTimes = useMemo(() => {
    const set = new Set<string>()
    for (const cs of courtSlots) for (const s of cs.slots) set.add(s.time)
    return set
  }, [courtSlots])
  const selectedSlot = form.courtId && form.startTime
    ? courtSlots.find((cs) => cs.courtId === form.courtId)?.slots.find((s) => s.time === form.startTime)
    : undefined

  const startMin = form.startTime ? timeToMinutes(form.startTime) : 0
  const endMin = startMin + form.duration
  const isOOB = !!form.startTime && form.duration > 0 && baseStart !== undefined && baseEnd !== undefined && (startMin < baseStart || endMin > baseEnd)

  const basePrice = selectedSlot && form.duration > 0
    ? calcBookingPrice(selectedSlot.pricePerHour, form.duration)
    : isOOB && baseBookingRule?.price != null && form.duration > 0
      ? calcBookingPrice(baseBookingRule.price, form.duration)
      : 0

  const courtName = courts.find((c) => c.id === form.courtId)?.name ?? ''

  const canSubmit =
    !!form.courtId && !!form.startTime && form.duration > 0 &&
    (form.bookingMode === 'BLOQUEO' ? !!form.blockEndTime : form.noClient || form.clientName.trim().length > 0) &&
    (!isOOB || form.oobConfirmed)

  // ── Sections visibility ────────────────────────────────────────────────
  const { sections, activeSection } = useFormSections(form, initialData, isExpanded)
  const isQuick = initialData.mode === 'quick' && !isExpanded
  const showDurationPicker = isQuick && initialData.durationLocked === false && form.bookingMode === 'RESERVA'
  const showQuickBloqueo = isQuick && form.bookingMode === 'BLOQUEO'
  const showPickers = initialData.mode === 'full' || isExpanded

  // ── Auto-fix duration when slots first load and default is not in admin rules (1A) ──
  // Runs once per load cycle. After that, any manual/custom selection is preserved.
  const durationAutoFixedRef = useRef(false)
  useEffect(() => {
    if (!showDurationPicker || isLoadingSlots || durationOptions.length === 0) {
      if (isLoadingSlots) durationAutoFixedRef.current = false // reset on re-fetch (date change)
      return
    }
    if (durationAutoFixedRef.current) return
    durationAutoFixedRef.current = true
    if (!durationOptions.includes(form.duration)) {
      dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: form.courtId, duration: durationOptions[0] } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDurationPicker, isLoadingSlots, durationOptions])

  const getSection = (id: string) => sections.find((s) => s.id === id)!

  // ── Focus management ───────────────────────────────────────────────────
  const prevActiveRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeSection === prevActiveRef.current) return
    prevActiveRef.current = activeSection

    const timer = setTimeout(() => {
      if (isQuick && activeSection === 'clientOrReason') {
        clientNameRef.current?.focus()
        return
      }
      switch (activeSection) {
        case 'time': firstTimeRef.current?.focus(); break
        case 'courtDuration': firstCourtRef.current?.focus(); break
        case 'blockEndTime': firstEndTimeRef.current?.focus(); break
        case 'clientOrReason':
          if (form.bookingMode === 'BLOQUEO') firstReasonRef.current?.focus()
          else clientNameRef.current?.focus()
          break
      }
    }, 160)
    return () => clearTimeout(timer)
  }, [activeSection, isQuick, form.bookingMode])

  // Auto-focus on mount: move focus into the modal container immediately,
  // then quick mode → client name, full mode → first time slot once loaded
  useEffect(() => {
    // Always grab focus into the floating panel on mount (prevents focus staying behind backdrop)
    const timer = setTimeout(() => containerRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (initialData.mode === 'quick') {
      const timer = setTimeout(() => clientNameRef.current?.focus(), 200)
      return () => clearTimeout(timer)
    }
  }, [initialData.mode])

  const slotsAutoFocusedRef = useRef(false)
  useEffect(() => {
    if (initialData.mode !== 'full') return
    if (isLoadingSlots || slotsAutoFocusedRef.current) return
    if (visibleTimes.length > 0) {
      slotsAutoFocusedRef.current = true
      setTimeout(() => firstTimeRef.current?.focus(), 100)
    }
  }, [initialData.mode, isLoadingSlots, visibleTimes.length])

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleModeChange = useCallback((m: BookingMode) => {
    dispatch({ type: 'SET_MODE', payload: m })
    if (m === 'BLOQUEO' && form.startTime && form.duration > 0) {
      dispatch({ type: 'SET_FIELD', field: 'blockEndTime', value: computeEndTime(form.startTime, form.duration) })
    }
  }, [form.startTime, form.duration])

  const handleSelectTime = useCallback((t: string) => {
    dispatch({ type: 'SET_TIME', payload: t })
    if (form.bookingMode === 'RESERVA') {
      const allDurs = courtSlots.flatMap((cs) => {
        const slot = cs.slots.find((s) => s.time === t)
        return slot?.available ? slot.durationOptions : []
      })
      const valid = [...new Set(allDurs)]
      const newDur = valid.includes(form.duration) ? form.duration : (valid[0] ?? 0)
      dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: '', duration: newDur } })
    }
  }, [form.bookingMode, form.duration, courtSlots])

  const handleBlockEndTimeChange = useCallback((endT: string) => {
    dispatch({ type: 'SET_FIELD', field: 'blockEndTime', value: endT })
    if (form.startTime && endT) {
      const dur = endTimeToMinutes(endT) - timeToMinutes(form.startTime)
      if (dur > 0) dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: form.courtId, duration: dur } })
    }
  }, [form.startTime, form.courtId])

  const handleReasonPreset = useCallback((preset: string) => {
    if (preset === '__custom__') {
      dispatch({ type: 'SET_FIELD', field: 'reasonPreset', value: '__custom__' })
      dispatch({ type: 'SET_FIELD', field: 'motivo', value: '' })
    } else {
      dispatch({ type: 'SET_REASON_PRESET', payload: preset })
    }
  }, [])

  const handleCustomReason = useCallback((val: string) => {
    dispatch({ type: 'SET_FIELD', field: 'motivo', value: val })
  }, [])

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    dispatch({ type: 'SET_FIELD', field: 'error', value: null })
    const priceOverride =
      form.bookingMode === 'RESERVA' && form.priceOverrideEnabled && form.priceOverrideInput.trim() !== ''
        ? parseInt(form.priceOverrideInput, 10) * 100 : undefined
    const payload = form.bookingMode === 'RESERVA'
      ? { clubId, courtId: form.courtId, date: form.date, startTime: form.startTime, durationMinutes: form.duration, bookingType: 'PRESENCIAL' as const, manualName: form.noClient ? undefined : (form.clientName.trim() || undefined), manualPhone: form.noClient ? undefined : (form.clientPhone.trim() || undefined), priceOverride, outOfHoursWarning: isOOB }
      : { clubId, courtId: form.courtId, date: form.date, startTime: form.startTime, durationMinutes: form.duration, bookingType: 'BLOQUEO' as const, blockReason: form.motivo.trim() || undefined }

    startTransition(async () => {
      const result = await createManualBooking(payload)
      if (result.success && result.data) {
        const bookingId = result.data.bookingId
        if (form.bookingMode === 'RESERVA' && !form.noClient && form.clientName.trim()) {
          saveClient(form.clientName.trim(), form.clientPhone.trim() || undefined)
        }
        toast.success(form.bookingMode === 'BLOQUEO' ? 'Bloqueo creado' : 'Reserva creada', { position: 'bottom-right' })
        const bookingWeekStart = getWeekStart(payload.date)
        queryClient.invalidateQueries({ queryKey: ['bookings', clubId, 'week', bookingWeekStart] })
        queryClient.invalidateQueries({ queryKey: ['floatingData', clubId, payload.date] })
        const optimisticBooking: BookingBlock = {
          id: bookingId, clubId, courtId: payload.courtId, startTime: payload.startTime,
          durationMinutes: payload.durationMinutes, status: 'CONFIRMED',
          source: payload.bookingType === 'BLOQUEO' ? 'BLOCK' : 'MANUAL_STAFF',
          displayName: payload.bookingType === 'BLOQUEO'
            ? (('blockReason' in payload && payload.blockReason) || 'Bloqueo')
            : (('manualName' in payload && payload.manualName) || '—'),
          totalPrice: priceOverride ?? basePrice, paymentStatus: 'UNPAID',
          manualPhone: 'manualPhone' in payload ? (payload.manualPhone ?? null) : null,
          date: payload.date,
        }
        if (payload.date === initialData.date) {
          queryClient.setQueryData(['bookings', clubId, 'week', bookingWeekStart], (old: BookingBlock[] | undefined) => [...(old ?? []), optimisticBooking])
          onCreated(bookingId)
        } else {
          onCreated(bookingId)
          router.push(`/admin/reservas?date=${payload.date}&highlight=${bookingId}`)
        }
      } else {
        const errorMsg = ('error' in result ? (result.error as string) : null) ?? 'Error al crear la reserva.'
        toast.error(errorMsg, { position: 'bottom-right' })
        dispatch({ type: 'SET_FIELD', field: 'error', value: errorMsg })
      }
    })
  }, [canSubmit, form, clubId, isOOB, basePrice, initialData.date, queryClient, router, onCreated, startTransition])

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

        {/* ── Quick BLOQUEO: end time + reason inline ───────────────── */}
        {showQuickBloqueo && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-150">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Hora fin</p>
              {isLoadingSlots ? (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 w-14 rounded-lg bg-surface animate-pulse" />)}
                </div>
              ) : (() => {
                const opts = getBlockEndOptions(form.startTime, form.courtId, courtSlots, baseEnd)
                return opts.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {opts.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleBlockEndTimeChange(t)}
                        className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-mono font-semibold cursor-pointer transition-all active:scale-95 ${
                          form.blockEndTime === t
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
                    onClick={() => handleReasonPreset(preset)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all active:scale-95 ${
                      form.reasonPreset === preset
                        ? 'bg-accent border-accent text-accent-text'
                        : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleReasonPreset('__custom__')}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all active:scale-95 ${
                    form.reasonPreset === '__custom__'
                      ? 'bg-accent border-accent text-accent-text'
                      : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                  }`}
                >
                  Otro...
                </button>
              </div>
              {form.reasonPreset === '__custom__' && (
                <input
                  type="text"
                  placeholder="Escribí el motivo..."
                  value={form.motivo}
                  onChange={(e) => handleCustomReason(e.target.value)}
                  className="mt-2 w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent animate-in fade-in slide-in-from-bottom-1 duration-150"
                />
              )}
            </div>
          </div>
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
          <>
            <DateSection
              stepNumber={stepFor('date')}
              date={form.date}
              isComplete={getSection('date').isComplete}
              isVisible={getSection('date').isVisible}
              clubId={clubId}
              onDateChange={(d) => dispatch({ type: 'SET_DATE', payload: d })}
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
              onSelectTime={handleSelectTime}
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
                onEndTimeChange={handleBlockEndTimeChange}
              />
            )}
          </>
        )}

        <OobWarning
          isVisible={isOOB}
          confirmed={form.oobConfirmed}
          onToggle={(v) => dispatch({ type: 'SET_FIELD', field: 'oobConfirmed', value: v })}
        />

        {/* Client / Reason section */}
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

        {/* Price */}
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
