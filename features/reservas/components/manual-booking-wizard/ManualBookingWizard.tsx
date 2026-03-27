'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ManualBookingWizardProps, BookingType } from './types/manualBookingWizard.types'
import { todayLocalStr, formatDateShort } from './helpers/manualBookingWizard.helpers'
import ManualBookingWizardStep1 from './ManualBookingWizardStep1/ManualBookingWizardStep1'
import ManualBookingWizardStep2Time from './ManualBookingWizardStep2Time/ManualBookingWizardStep2Time'
import ManualBookingWizardStep3Duration from './ManualBookingWizardStep3Duration/ManualBookingWizardStep3Duration'
import ManualBookingWizardStep3Court from './ManualBookingWizardStep3Court/ManualBookingWizardStep3Court'
import ManualBookingWizardStep2 from './ManualBookingWizardStep2/ManualBookingWizardStep2'
import ManualBookingWizardStep3 from './ManualBookingWizardStep3/ManualBookingWizardStep3'

function fmtDuration(d: number) {
  return d === 60 ? '1h' : d === 90 ? '1h 30' : d === 120 ? '2h' : `${d} min`
}

function CompletedChip({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card
                 hover:border-accent/40 hover:bg-card-hover transition-all duration-[130ms] group cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-[1.5px] text-muted shrink-0 w-[52px] text-left">
          {label}
        </span>
        <span className="text-[13px] font-semibold text-text truncate">{value}</span>
      </div>
      <svg
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round"
        className="text-muted/40 group-hover:text-muted shrink-0 ml-2 transition-colors"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
}

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

  const [courtId, setCourtId] = useState(
    defaultCourtId && courts.some((c) => c.id === defaultCourtId) ? defaultCourtId : ''
  )
  const [date, setDate] = useState(defaultDate ?? availableDates[0] ?? todayLocalStr())
  const [startTime, setStartTime] = useState(defaultTime ?? '')
  const [duration, setDuration] = useState(() => {
    if (defaultCourtId && defaultDate && defaultTime) {
      const courtSlots = courtSlotsByDate[defaultDate]?.find((cs) => cs.courtId === defaultCourtId)
      const slot = courtSlots?.slots.find((s) => s.time === defaultTime)
      const opts = slot?.durationOptions ?? []
      if (opts.length > 0) return opts.includes(90) ? 90 : opts[opts.length - 1]!
    }
    return 0
  })
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

  // If all defaults provided (clicked from grid slot), jump straight to client info
  useEffect(() => {
    if (defaultCourtId && defaultDate && defaultTime && step === 1) {
      setStep(5)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goToStep(n: number) {
    setStep(n)
    if (n <= 1) { setStartTime(''); setCourtId('') }
    else if (n <= 3) { setCourtId('') }
    setError(null)
  }

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

  const TOTAL_STEPS = 6

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
      <div className="sticky top-0 z-10 px-5 pt-[18px] pb-[14px] bg-surface border-b border-border flex items-start justify-between gap-3">
        <h1 className="font-display text-[22px] tracking-[3px] leading-none text-text">NUEVA RESERVA</h1>
        <button
          type="button"
          onClick={() => { if (onClose) { onClose(date); return } router.push(`/admin/reservas?date=${date}`) }}
          className="shrink-0 size-8 rounded-xl border border-border bg-transparent text-muted
                     flex items-center justify-center cursor-pointer transition-all duration-[130ms]
                     hover:text-text hover:border-border-hover -mt-0.5"
          aria-label="Cerrar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-border shrink-0">
        <div
          className="h-full bg-accent transition-[width] duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Completed steps as accordion chips */}
      {step > 1 && (
        <div className="px-5 pt-4 flex flex-col gap-2">
          <CompletedChip
            label="Fecha"
            value={formatDateShort(date)}
            onEdit={() => goToStep(1)}
          />
          {step > 2 && (
            <CompletedChip
              label="Horario"
              value={startTime}
              onEdit={() => goToStep(2)}
            />
          )}
          {step > 3 && duration > 0 && (
            <CompletedChip
              label="Duración"
              value={fmtDuration(duration)}
              onEdit={() => goToStep(3)}
            />
          )}
          {step > 4 && (
            <CompletedChip
              label="Cancha"
              value={courtName}
              onEdit={() => goToStep(4)}
            />
          )}
          {step > 5 && (
            <CompletedChip
              label="Cliente"
              value={bookingType === 'BLOQUEO' ? (blockReason || 'Bloqueo') : clientName || 'Presencial'}
              onEdit={() => goToStep(5)}
            />
          )}
        </div>
      )}

      {/* Active step content */}
      <div key={step} className="p-5 flex flex-col animate-wz-fade-in">
        {step === 1 && (
          <ManualBookingWizardStep1
            date={date}
            setDate={(d) => { setDate(d); setStartTime(''); setCourtId(''); setStep(2) }}
            availableDates={availableDates}
          />
        )}
        {step === 2 && (
          <ManualBookingWizardStep2Time
            date={date}
            startTime={startTime}
            setStartTime={(t) => { setStartTime(t); setCourtId('') }}
            courtSlotsByDate={courtSlotsByDate}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <ManualBookingWizardStep3Duration
            date={date}
            startTime={startTime}
            duration={duration}
            setDuration={setDuration}
            courtSlotsByDate={courtSlotsByDate}
            durationOptions={durationOptions}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <ManualBookingWizardStep3Court
            courts={courts}
            courtId={courtId}
            setCourtId={(id) => { setCourtId(id); setStep(5) }}
            date={date}
            startTime={startTime}
            duration={duration}
            courtSlotsByDate={courtSlotsByDate}
          />
        )}
        {step === 5 && (
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
            onNext={() => setStep(6)}
            onBack={() => goToStep(4)}
          />
        )}
        {step === 6 && (
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
            onBack={() => setStep(5)}
          />
        )}
      </div>
    </div>
  )
}
