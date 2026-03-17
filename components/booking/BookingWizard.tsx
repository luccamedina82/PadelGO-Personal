'use client'

import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { argToday } from '@/lib/date'
import CourtDiagram from './CourtDiagram'
import type { CourtType } from '@/types'
import {
  calcAvailableSlots,
  calcBookingPrice,
  formatPrice,
  DEFAULT_DURATION,
  type DurationMinutes,
  type AvailabilityConfig,
  type ExistingBooking,
} from '@/lib/availability'
import type { createBooking, createGhostBooking } from '@/actions/booking'
import type { createMercadoPagoPreference, setManualPayment, setGuestManualPayment } from '@/actions/payment'

// ── TYPES ─────────────────────────────────────────────────────────────────

export interface CourtForWizard {
  id: string
  name: string
  type: CourtType
  covered: boolean
  svgX: number
  svgY: number
  svgW: number
  svgH: number
  isActive: boolean
  /** Availability config keyed by dayOfWeek (0=Sun…6=Sat) */
  availabilityByDay: Record<number, AvailabilityConfig>
}

/** Existing bookings: courtId → dateStr (YYYY-MM-DD) → list */
export type BookingMap = Record<string, Record<string, ExistingBooking[]>>

interface BookingWizardProps {
  clubId: string
  clubName: string
  cancelHoursBeforeStart: number
  courts: CourtForWizard[]
  existingBookings: BookingMap
  /** null = unauthenticated */
  userId: string | null
  createBookingAction: typeof createBooking
  createGhostBookingAction: typeof createGhostBooking
  createMercadoPagoPreferenceAction: typeof createMercadoPagoPreference
  setManualPaymentAction: typeof setManualPayment
  setGuestManualPaymentAction: typeof setGuestManualPayment
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function buildDates(): Date[] {
  const today = argToday()
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() + i) // today to D+13 (14 days total)
    return d
  })
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]
const DURATION_LABELS: Record<number, string> = { 60: '1h', 90: '1h 30m', 120: '2h' }

type Period = 'Mañana' | 'Tarde' | 'Noche'

function slotPeriod(time: string): Period {
  const [h] = time.split(':').map(Number)
  if (h < 12) return 'Mañana'
  if (h < 19) return 'Tarde'
  return 'Noche'
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function BookingWizard({
  clubId,
  courts,
  existingBookings,
  userId,
  createBookingAction,
  createGhostBookingAction,
  createMercadoPagoPreferenceAction,
  setManualPaymentAction,
  setGuestManualPaymentAction,
}: BookingWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Step 1: date; Step 2: court + slot; Step 3: duration + confirm; Step 4: payment
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  const dates = useMemo(() => buildDates(), [])

  const [selectedDate, setSelectedDate] = useState<Date>(dates[0])
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(
    courts.length > 0 ? courts[0].id : null
  )
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<DurationMinutes>(DEFAULT_DURATION)
  const [error, setError] = useState<string | null>(null)

  // Payment state (Step 4)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Guest state (only relevant when userId is null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestReady, setGuestReady] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  // Cooldown after slot selection (2s)
  const [cooldownPct, setCooldownPct] = useState(0)
  const [cooldownActive, setCooldownActive] = useState(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!cooldownActive) return
    const start = Date.now()
    const DURATION = 2000
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / DURATION) * 100)
      setCooldownPct(pct)
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setCooldownActive(false)
        setCooldownPct(0)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [cooldownActive])

  // ── Derive current court ──────────────────────────────────────────────

  const selectedCourt = useMemo(
    () => courts.find((c) => c.id === selectedCourtId) ?? null,
    [courts, selectedCourtId]
  )

  // ── Compute time slots for selected court + date ──────────────────────

  const slots = useMemo(() => {
    if (!selectedCourt || !selectedDate) return []
    const dayOfWeek = selectedDate.getDay()
    const config = selectedCourt.availabilityByDay[dayOfWeek]
    if (!config) return []
    const dateKey = formatDateKey(selectedDate)
    const bookings = existingBookings[selectedCourt.id]?.[dateKey] ?? []
    return calcAvailableSlots(config, bookings, selectedDate)
  }, [selectedCourt, selectedDate, existingBookings])
  // Group slots by period
  const slotsByPeriod = useMemo(() => {
    const groups: Record<Period, typeof slots> = { Mañana: [], Tarde: [], Noche: [] }
    for (const slot of slots) {
      groups[slotPeriod(slot.time)].push(slot)
    }
    return groups
  }, [slots])

  // ── Price computation ─────────────────────────────────────────────────

  const pricePerHour = useMemo(() => {
    if (!selectedCourt || !selectedDate) return 0
    const config = selectedCourt.availabilityByDay[selectedDate.getDay()]
    return config?.pricePerHour ?? 0
  }, [selectedCourt, selectedDate])

  const totalPrice = useMemo(
    () => calcBookingPrice(pricePerHour, selectedDuration),
    [pricePerHour, selectedDuration]
  )

  // ── Derived duration options for selected slot ────────────────────────

  const durationOptions = useMemo(() => {
    if (!selectedTime) return []
    const slot = slots.find((s) => s.time === selectedTime)
    return slot?.durationOptions ?? []
  }, [slots, selectedTime])

  // ── Handlers ──────────────────────────────────────────────────────────

  function handleSelectDate(date: Date) {
    setSelectedDate(date)
    setSelectedTime(null)
    setCooldownActive(false)
  }

  function handleSelectCourt(id: string) {
    setSelectedCourtId(id)
    setSelectedTime(null)
    setCooldownActive(false)
  }

  function handleSelectSlot(time: string) {
    setSelectedTime(time)
    setSelectedDuration(DEFAULT_DURATION)
    setError(null)
    // Start 2s cooldown to prevent accidental double-tap
    setCooldownActive(true)
    setCooldownPct(0)
  }

  function handleRetryAfterSlotTaken() {
    setError(null)
    setSelectedTime(null)
    setCooldownActive(false)
    setStep(2)
    router.refresh()
  }

  function handleGuestContinue(e: React.FormEvent) {
    e.preventDefault()
    setGuestError(null)
    if (!guestName.trim()) {
      setGuestError('El nombre es obligatorio.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      setGuestError('Ingresá un email válido.')
      return
    }
    setGuestReady(true)
    setStep(2)
  }

  function handleConfirm() {
    if (!selectedCourtId || !selectedTime || !selectedDate) return
    setError(null)

    if (userId) {
      // Authenticated booking
      startTransition(async () => {
        const result = await createBookingAction({
          clubId,
          courtId: selectedCourtId,
          date: formatDateKey(selectedDate),
          startTime: selectedTime,
          durationMinutes: selectedDuration,
        })

        if (result.success && result.data?.bookingId) {
          setBookingId(result.data.bookingId)
          setStep(4) // Advance to payment step
        } else if (!result.success) {
          setError(result.error ?? null)
          if (result.error !== 'SLOT_TAKEN') {
            setStep(2)
            setSelectedTime(null)
          }
        }
      })
    } else {
      // Guest booking
      startTransition(async () => {
        const result = await createGhostBookingAction({
          clubId,
          courtId: selectedCourtId,
          date: formatDateKey(selectedDate),
          startTime: selectedTime,
          durationMinutes: selectedDuration,
          guestName,
          guestEmail,
        })

        if (result.success && result.data?.bookingId) {
          setBookingId(result.data.bookingId)
          setStep(4) // Advance to payment step
        } else if (!result.success) {
          setError(result.error ?? null)
          if (result.error !== 'SLOT_TAKEN' && result.error !== 'ACCOUNT_EXISTS') {
            setStep(2)
            setSelectedTime(null)
          }
        }
      })
    }
  }

  // ── Payment handlers ───────────────────────────────────────────────────

  function handlePayOnline() {
    if (!bookingId) return
    setPaymentError(null)

    startTransition(async () => {
      const result = await createMercadoPagoPreferenceAction(bookingId)
      if (result.success && result.data?.initPoint) {
        // Redirect to Mercado Pago checkout
        window.location.href = result.data.initPoint
      } else if (!result.success) {
        setPaymentError(result.error ?? 'Error al conectar con Mercado Pago. Intentá de nuevo.')
      }
    })
  }

  function handlePayAtClub() {
    if (!bookingId) return
    setPaymentError(null)

    startTransition(async () => {
      // Use the appropriate action based on user type
      const result = userId
        ? await setManualPaymentAction(bookingId)
        : await setGuestManualPaymentAction(bookingId)

      if (result.success) {
        router.push(`/confirmar/${bookingId}`)
      } else if (!result.success) {
        setPaymentError(result.error ?? 'Error al procesar. Intentá de nuevo.')
      }
    })
  }

  // ── Progress indicator ────────────────────────────────────────────────

  const STEPS = ['Fecha', 'Horario', 'Confirmar', 'Pago']

  // Redirect path for login/register
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/club/${clubId}`

  // ── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Step header */}
      <div className="flex border-b border-border">
        {STEPS.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3 | 4
          const isActive = step === stepNum
          const isDone = step > stepNum
          return (
            <button
              key={label}
              type="button"
              onClick={() => isDone && setStep(stepNum)}
              disabled={!isDone}
              className={`flex-1 py-3 text-xs font-semibold tracking-wide transition-colors border-r last:border-r-0 border-border ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : isDone
                    ? 'text-muted hover:text-text cursor-pointer'
                    : 'text-sub cursor-default'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-1.5 ${
                  isActive
                    ? 'bg-accent text-accent-text'
                    : isDone
                      ? 'bg-border text-muted'
                      : 'bg-surface text-sub'
                }`}
              >
                {isDone ? '✓' : stepNum}
              </span>
              {label}
            </button>
          )
        })}
      </div>

      <div className="p-4">
        {/* ── STEP 1: Auth gate OR date picker ───────────── */}
        {step === 1 && (
          <div>
            {/* ── Unauthenticated: show auth options + guest form ── */}
            {!userId && !guestReady ? (
              <div className="space-y-4">
                <p className="text-xs text-muted">¿Tenés cuenta en PadelGo?</p>

                {/* Login / Register buttons */}
                <div className="flex gap-2">
                  <a
                    href={`/login?redirect=${encodeURIComponent(currentPath)}`}
                    className="flex-1 py-2.5 text-center text-sm font-semibold bg-accent text-accent-text rounded-xl hover:bg-accent-dark transition-colors"
                  >
                    Iniciar sesión
                  </a>
                  <a
                    href={`/registro?redirect=${encodeURIComponent(currentPath)}`}
                    className="flex-1 py-2.5 text-center text-sm font-semibold bg-surface border border-border text-text rounded-xl hover:bg-card transition-colors"
                  >
                    Registrarse
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-sub">o continuá sin cuenta</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Guest form */}
                <form onSubmit={handleGuestContinue} className="space-y-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Tu nombre</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Nombre y apellido"
                      autoComplete="name"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Tu email</label>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="hola@ejemplo.com"
                      autoComplete="email"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
                    />
                  </div>

                  {guestError && (
                    <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
                      {guestError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-surface border border-border text-text text-sm font-semibold rounded-xl hover:bg-card hover:border-border-hover transition-colors"
                  >
                    Reservar como invitado →
                  </button>
                </form>
              </div>
            ) : (
              /* ── Authenticated or guest ready: date picker ── */
              <div>
                {/* Guest identity banner */}
                {!userId && guestReady && (
                  <div className="mb-3 bg-surface border border-border rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted">Reservando como invitado</p>
                      <p className="text-sm font-semibold text-text truncate">{guestName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestReady(false)
                        setStep(1)
                      }}
                      className="text-xs text-sub hover:text-muted underline flex-shrink-0"
                    >
                      Cambiar
                    </button>
                  </div>
                )}

                <p className="text-xs text-muted mb-3">Elegí la fecha de tu turno</p>

                {/* 14-day horizontal scroll */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {dates.map((date) => {
                    const isSelected = date.toDateString() === selectedDate.toDateString()
                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => handleSelectDate(date)}
                        className={`flex flex-col items-center px-3 py-2 rounded-xl border flex-shrink-0 min-w-[56px] transition-colors ${
                          isSelected
                            ? 'bg-accent border-accent text-accent-text'
                            : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
                        }`}
                      >
                        <span className="text-xs font-medium">{DAY_LABELS[date.getUTCDay()]}</span>
                        <span className="font-mono text-lg font-semibold leading-none mt-0.5">
                          {date.getUTCDate()}
                        </span>
                        <span className="text-xs opacity-70">{MONTH_LABELS[date.getUTCMonth()]}</span>
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-5 w-full py-2.5 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors"
                >
                  Continuar →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Court + Time slot ─────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Selected date reminder */}
            <p className="text-xs text-muted">
              Fecha:{' '}
              <span className="text-text font-semibold">
                {DAY_LABELS[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{' '}
                {MONTH_LABELS[selectedDate.getUTCMonth()]}
              </span>
            </p>

            {/* Court diagram */}
            <CourtDiagram
              courts={courts}
              selectedCourtId={selectedCourtId}
              onSelectCourt={handleSelectCourt}
            />

            {/* Time slots */}
            {selectedCourt ? (
              <div>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">
                    No hay horarios disponibles para este día.
                  </p>
                ) : (
                  (['Mañana', 'Tarde', 'Noche'] as Period[]).map((period) => {
                    const periodSlots = slotsByPeriod[period]
                    if (periodSlots.length === 0) return null
                    return (
                      <div key={period} className="mb-4">
                        <p className="text-xs font-semibold text-sub tracking-widest uppercase mb-2">
                          {period}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {periodSlots.map((slot) => {
                            const isSelected = selectedTime === slot.time
                            if (!slot.available) {
                              // Occupied slot — non-clickable with clear visual indicator
                              return (
                                <div
                                  key={slot.time}
                                  className="relative px-3 py-1.5 rounded-lg text-sm font-mono font-medium border select-none"
                                  style={{
                                    background: 'var(--surface)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--sub)',
                                    cursor: 'not-allowed',
                                    opacity: 0.5,
                                  }}
                                  title="Turno ya reservado"
                                >
                                  <span className="line-through">{slot.time}</span>
                                  <span
                                    className="absolute -top-2 -right-1 text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded"
                                    style={{
                                      background: 'rgba(239,68,68,0.15)',
                                      color: 'rgb(239,68,68)',
                                      border: '1px solid rgba(239,68,68,0.25)',
                                    }}
                                  >
                                    Ocupado
                                  </span>
                                </div>
                              )
                            }
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                onClick={() => handleSelectSlot(slot.time)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-all ${
                                  isSelected
                                    ? 'bg-accent text-accent-text border-accent scale-105 shadow-md'
                                    : 'bg-surface border-border text-text hover:border-border-hover hover:bg-card'
                                }`}
                              >
                                {isSelected && <span className="mr-1 text-xs">🔒</span>}
                                {slot.time}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-4">
                Seleccioná una cancha para ver los horarios.
              </p>
            )}

            {/* Continue button with cooldown progress bar */}
            <div className="relative">
              <button
                type="button"
                disabled={!selectedTime || !selectedCourtId || cooldownActive}
                onClick={() => setStep(3)}
                className="w-full py-2.5 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
              >
                {cooldownActive ? 'Reservando turno...' : 'Continuar →'}
                {/* Cooldown progress bar */}
                {cooldownActive && (
                  <span
                    className="absolute bottom-0 left-0 h-0.5 bg-accent-text/40 transition-none"
                    style={{ width: `${cooldownPct}%` }}
                  />
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Duration + Price + Confirm ───────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* SLOT_TAKEN inline modal */}
            {error === 'SLOT_TAKEN' && (
              <div
                className="rounded-xl p-4 border"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  borderColor: 'rgba(239,68,68,0.25)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-text mb-1">
                      Este turno acaba de ser reservado
                    </p>
                    <p className="text-xs text-muted mb-3">
                      Alguien llegó primero. Elegí otro horario.
                    </p>
                    <button
                      type="button"
                      onClick={handleRetryAfterSlotTaken}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-accent-text hover:bg-accent-dark transition-colors"
                    >
                      Ver otros turnos →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT_EXISTS inline modal */}
            {error === 'ACCOUNT_EXISTS' && (
              <div
                className="rounded-xl p-4 border"
                style={{
                  background: 'rgba(251,191,36,0.06)',
                  borderColor: 'rgba(251,191,36,0.25)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">👤</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-text mb-1">
                      Ya tenés una cuenta con ese email
                    </p>
                    <p className="text-xs text-muted mb-3">
                      Iniciá sesión para completar la reserva con tu cuenta.
                    </p>
                    <a
                      href={`/login?redirect=${encodeURIComponent(currentPath)}`}
                      className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-accent-text hover:bg-accent-dark transition-colors"
                    >
                      Iniciar sesión →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Cancha</span>
                <span className="text-text font-medium">{selectedCourt?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Fecha</span>
                <span className="text-text font-medium">
                  {DAY_LABELS[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{' '}
                  {MONTH_LABELS[selectedDate.getUTCMonth()]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Horario</span>
                <span className="font-mono text-text font-medium">{selectedTime}</span>
              </div>
              {!userId && guestReady && (
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-muted">Invitado</span>
                  <span className="text-text font-medium">{guestName}</span>
                </div>
              )}
            </div>

            {/* Duration selector */}
            <div>
              <p className="text-xs font-semibold text-sub tracking-widest uppercase mb-2">
                Duración
              </p>
              <div className="flex gap-2">
                {durationOptions.map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setSelectedDuration(dur as DurationMinutes)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      selectedDuration === dur
                        ? 'bg-accent text-accent-text border-accent'
                        : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
                    }`}
                  >
                    {DURATION_LABELS[dur] ?? `${dur}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Total price */}
            <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-4">
              <span className="text-sm text-muted">Total a pagar</span>
              <span className="font-mono text-2xl font-semibold text-accent">
                {formatPrice(totalPrice)}
              </span>
            </div>

            {/* Generic error (non-SLOT_TAKEN, non-ACCOUNT_EXISTS) */}
            {error && error !== 'SLOT_TAKEN' && error !== 'ACCOUNT_EXISTS' && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Confirm button */}
            {error !== 'SLOT_TAKEN' && error !== 'ACCOUNT_EXISTS' && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className="w-full py-3 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? 'Reservando...' : 'Continuar al pago →'}
              </button>
            )}

            <p className="text-xs text-center text-sub">
              Al confirmar aceptás los términos del club y la política de cancelación.
            </p>
          </div>
        )}

        {/* ── STEP 4: Payment options ───────────────── */}
        {step === 4 && bookingId && (
          <div className="space-y-4">
            {/* Mini summary */}
            <div className="bg-surface border border-border rounded-xl p-4 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted">Tu reserva</span>
                <span className="text-xs text-accent font-semibold">PENDIENTE DE PAGO</span>
              </div>
              <p className="font-semibold text-text">
                {selectedCourt?.name} · {DAY_LABELS[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{' '}
                {MONTH_LABELS[selectedDate.getUTCMonth()]}
              </p>
              <p className="text-muted">{selectedTime} · {DURATION_LABELS[selectedDuration]}</p>
              <div className="mt-2 pt-2 border-t border-border flex justify-between">
                <span className="text-muted">Total</span>
                <span className="font-mono font-semibold text-accent">{formatPrice(totalPrice)}</span>
              </div>
            </div>

            {/* Payment method label */}
            <p className="text-xs font-semibold text-sub tracking-widest uppercase">
              Elegí cómo pagar
            </p>

            {/* Mercado Pago option - only for authenticated users */}
            {userId && (
              <button
                type="button"
                onClick={handlePayOnline}
                disabled={isPending}
                className="w-full p-4 rounded-xl border text-left transition-colors
                  bg-accent text-accent-text border-accent hover:bg-accent-dark
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  {isPending ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <span className="text-2xl">💳</span>
                  )}
                  <div>
                    <p className="font-semibold text-sm">Pagar con Mercado Pago</p>
                    <p className="text-xs opacity-80">Tarjeta, débito o efectivo</p>
                  </div>
                </div>
              </button>
            )}

            {/* Cash at club option */}
            <button
              type="button"
              onClick={handlePayAtClub}
              disabled={isPending}
              className="w-full p-4 rounded-xl border text-left transition-colors
                bg-surface text-text border-border hover:border-border-hover hover:bg-card
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">💵</span>
                <div>
                  <p className="font-semibold text-sm">Pagar en efectivo en el club</p>
                  <p className="text-xs text-muted">Abonás cuando llegues</p>
                </div>
              </div>
            </button>

            {/* Error display */}
            {paymentError && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {paymentError}
              </p>
            )}

            {/* Back button */}
            <button
              type="button"
              onClick={() => {
                setStep(3)
                setPaymentError(null)
              }}
              className="w-full text-center py-2 text-sm text-muted hover:text-text transition-colors"
            >
              ← Volver
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
