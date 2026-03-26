'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ManualBookingWizardProps, BookingType } from './types/manualBookingWizard.types'
import { todayLocalStr, formatDateShort } from './helpers/manualBookingWizard.helpers'
import StepDots from './StepDots/StepDots'
import ManualBookingWizardStep1 from './ManualBookingWizardStep1/ManualBookingWizardStep1'
import ManualBookingWizardStep2Time from './ManualBookingWizardStep2Time/ManualBookingWizardStep2Time'
import ManualBookingWizardStep3Court from './ManualBookingWizardStep3Court/ManualBookingWizardStep3Court'
import ManualBookingWizardStep2 from './ManualBookingWizardStep2/ManualBookingWizardStep2'
import ManualBookingWizardStep3 from './ManualBookingWizardStep3/ManualBookingWizardStep3'

export default function ManualBookingWizard({
  courts,
  courtSlotsByDate,
  availableDates,
  clubId,
  createManualBookingAction,
  defaultCourtId,
  defaultDate,
  defaultTime,
  onClose,
  onBookingCreated,
  durationOptions,
}: ManualBookingWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Step 1 state
  const [courtId, setCourtId] = useState(
    defaultCourtId && courts.some((c) => c.id === defaultCourtId) ? defaultCourtId : ''
  )
  const [date, setDate] = useState(defaultDate ?? availableDates[0] ?? todayLocalStr())

  // Step 2 state (time + duration)
  const [startTime, setStartTime] = useState(defaultTime ?? '')
  const [duration, setDuration] = useState(() => {
    // When opening from the grid (all defaults provided), cap duration to what the specific
    // court actually allows at that time (closeTime constraint).
    if (defaultCourtId && defaultDate && defaultTime) {
      const courtSlots = courtSlotsByDate[defaultDate]?.find((cs) => cs.courtId === defaultCourtId)
      const slot = courtSlots?.slots.find((s) => s.time === defaultTime)
      const opts = slot?.durationOptions ?? []
      if (opts.length > 0) return opts.includes(90) ? 90 : opts[opts.length - 1]!
    }
    return 60
  })

  // Step 3 state (client info)
  const [bookingType, setBookingType] = useState<BookingType>('PRESENCIAL')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blockSource, setBlockSource] = useState<string>('BLOCK')

  useEffect(() => {
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current) }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const courtName = courts.find((c) => c.id === courtId)?.name ?? ''

  // If all defaults provided, jump straight to client info (step 4)
  useEffect(() => {
    if (defaultCourtId && defaultDate && defaultTime && step === 1) {
      setStep(4)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleConfirm() {
    if (!courtId || !startTime) return
    if (redirectTimerRef.current) { clearTimeout(redirectTimerRef.current); redirectTimerRef.current = null }
    setError(null)
    startTransition(async () => {
      const result = await createManualBookingAction({
        clubId,
        courtId,
        date,
        startTime,
        durationMinutes: duration,
        bookingType,
        manualName: bookingType !== 'BLOQUEO' ? clientName.trim() || undefined : undefined,
        manualPhone: bookingType !== 'BLOQUEO' ? clientPhone.trim() || undefined : undefined,
        blockReason: bookingType === 'BLOQUEO' ? blockReason.trim() || undefined : undefined,
        blockSource: bookingType === 'BLOQUEO' ? blockSource : undefined,
      })
      if (result.success) {
        setSuccess(true)
        redirectTimerRef.current = setTimeout(() => {
          const newId = result.data?.bookingId
          setSuccess(false)
          if (onBookingCreated) {
            onBookingCreated({ date, bookingId: newId })
            redirectTimerRef.current = null
            return
          }
          router.push(`/admin/reservas?date=${date}${newId ? `&new=${newId}` : ''}`)
          redirectTimerRef.current = null
        }, 2000)
      } else {
        setError(result.error ?? 'Error al crear la reserva.')
      }
    })
  }

  const TOTAL_STEPS = 5

  return (
    <div
      className="relative flex flex-col h-full bg-bg overflow-y-auto overflow-x-hidden
                 [scrollbar-width:thin] [scrollbar-color:var(--sub)_transparent]"
      ref={scrollRef}
    >
      {/* Success overlay */}
      {success && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center animate-wz-success-overlay">
          <div className="flex flex-col items-center gap-6">
            <div className="size-[88px] rounded-full bg-[#22c55e] flex items-center justify-center animate-wz-success-circle shadow-[0_0_40px_rgba(34,197,94,0.35)]">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="animate-wz-success-check" />
              </svg>
            </div>
            <div className="animate-wz-success-label text-center">
              <p className="text-white text-[17px] font-bold tracking-[2.5px] uppercase">Reserva creada</p>
              <p className="text-white/40 text-[11px] mt-[5px] tracking-wider">Redirigiendo...</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 px-5 pt-[18px] pb-[14px] bg-surface border-b border-border flex flex-col gap-[14px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[22px] tracking-[3px] leading-none text-text">NUEVA RESERVA</h1>
            <p className="text-[11px] text-muted mt-[3px] capitalize truncate">
              {date
                ? `${formatDateShort(date)}${startTime ? ` · ${startTime}` : ''}${courtName ? ` · ${courtName}` : ''}`
                : 'Seleccioná una fecha'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { if (onClose) { onClose(date); return } router.push(`/admin/reservas?date=${date}`) }}
            className="shrink-0 size-8 rounded-xl border border-border bg-transparent text-muted
                       flex items-center justify-center cursor-pointer transition-all duration-[130ms]
                       hover:text-text hover:border-border-hover -mt-0.5"
            aria-label="Cancelar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <StepDots current={step} />
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-border shrink-0">
        <div
          className="h-full bg-accent transition-[width] duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <div key={step} className="p-5 flex flex-col animate-wz-fade-in">
        {step === 1 && (
          <ManualBookingWizardStep1
            date={date}
            setDate={(d) => { setDate(d); setStartTime(''); setCourtId('') }}
            availableDates={availableDates}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <ManualBookingWizardStep2Time
            date={date}
            startTime={startTime}
            setStartTime={(t) => { setStartTime(t); setCourtId('') }}
            duration={duration}
            setDuration={(d) => { setDuration(d); setCourtId('') }}
            courtSlotsByDate={courtSlotsByDate}
            durationOptions={durationOptions}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <ManualBookingWizardStep3Court
            courts={courts}
            courtId={courtId}
            setCourtId={setCourtId}
            date={date}
            startTime={startTime}
            duration={duration}
            courtSlotsByDate={courtSlotsByDate}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <ManualBookingWizardStep2
            bookingType={bookingType}
            setBookingType={setBookingType}
            clientName={clientName}
            setClientName={setClientName}
            clientPhone={clientPhone}
            setClientPhone={setClientPhone}
            blockReason={blockReason}
            setBlockReason={setBlockReason}
            setBlockSource={setBlockSource}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && (
          <ManualBookingWizardStep3
            courtName={courtName}
            date={date}
            startTime={startTime}
            duration={duration}
            bookingType={bookingType}
            clientName={clientName}
            blockReason={blockReason}
            isPending={isPending}
            error={error}
            onConfirm={handleConfirm}
            onBack={() => setStep(4)}
          />
        )}
      </div>
    </div>
  )
}
