'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  calcAvailableSlots,
  calcBookingPrice,
  type DurationMinutes,
} from '@/lib/availability'
import {
  Step1AuthDate,
  Step2CourtAndSlots,
  Step3Confirm,
  Step4Payment,
  StepHeader,
} from './BookingWizardSteps/BookingWizardSteps'
import { buildDates, formatDateKey, slotPeriod } from './helpers/bookingWizard.helpers'
import type {
  BookingMap,
  BookingStep,
  BookingWizardProps,
  CourtForWizard,
  Period,
} from './types/bookingWizard.types'

export type { BookingMap, CourtForWizard }

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
  const [step, setStep] = useState<BookingStep>(1)

  const dates = useMemo(() => buildDates(), [])

  const [selectedDate, setSelectedDate] = useState<Date>(dates[0])
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(
    courts.length > 0 ? courts[0].id : null
  )
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<DurationMinutes>(60)
  const [error, setError] = useState<string | null>(null)

  // Payment state (Step 4)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'mp' | 'cash' | null>(null)

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

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date)
    setSelectedTime(null)
    setCooldownActive(false)
  }, [])

  const handleSelectCourt = useCallback((id: string) => {
    setSelectedCourtId(id)
    setSelectedTime(null)
    setCooldownActive(false)
  }, [])

  const handleSelectSlot = useCallback((time: string) => {
    setSelectedTime(time)
    setSelectedDuration(60)
    setError(null)
    // Start 2s cooldown to prevent accidental double-tap
    setCooldownActive(true)
    setCooldownPct(0)
  }, [])

  const handleRetryAfterSlotTaken = useCallback(() => {
    setError(null)
    setSelectedTime(null)
    setCooldownActive(false)
    setStep(2)
    router.refresh()
  }, [router])

  const handleGuestContinue = useCallback((e: React.FormEvent) => {
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
  }, [guestEmail, guestName])

  const handleConfirm = useCallback(() => {
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
  }, [
    clubId,
    createBookingAction,
    createGhostBookingAction,
    guestEmail,
    guestName,
    selectedCourtId,
    selectedDate,
    selectedDuration,
    selectedTime,
    startTransition,
    userId,
  ])

  // ── Payment handlers ───────────────────────────────────────────────────

  const handlePayOnline = useCallback(() => {
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
  }, [bookingId, createMercadoPagoPreferenceAction, startTransition])

  const handlePayAtClub = useCallback(() => {
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
  }, [
    bookingId,
    router,
    setGuestManualPaymentAction,
    setManualPaymentAction,
    startTransition,
    userId,
  ])

  const handleConfirmPayment = useCallback(() => {
    if (selectedPaymentMethod === 'mp') {
      handlePayOnline()
    } else if (selectedPaymentMethod === 'cash') {
      handlePayAtClub()
    }
  }, [handlePayAtClub, handlePayOnline, selectedPaymentMethod])

  const currentPath = useMemo(
    () => (typeof window !== 'undefined' ? window.location.pathname : `/club/${clubId}`),
    [clubId]
  )

  // ── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <StepHeader step={step} onGoToStep={setStep} />

      <div className="p-4">
        {step === 1 && (
          <Step1AuthDate
            userId={userId}
            guestReady={guestReady}
            guestName={guestName}
            guestEmail={guestEmail}
            guestError={guestError}
            dates={dates}
            selectedDate={selectedDate}
            currentPath={currentPath}
            onGuestNameChange={setGuestName}
            onGuestEmailChange={setGuestEmail}
            onGuestContinue={handleGuestContinue}
            onGuestReset={() => {
              setGuestReady(false)
              setStep(1)
            }}
            onSelectDate={handleSelectDate}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <Step2CourtAndSlots
            selectedDate={selectedDate}
            courts={courts}
            selectedCourtId={selectedCourtId}
            selectedCourt={selectedCourt}
            selectedTime={selectedTime}
            slots={slots}
            slotsByPeriod={slotsByPeriod}
            cooldownActive={cooldownActive}
            cooldownPct={cooldownPct}
            onSelectCourt={handleSelectCourt}
            onSelectSlot={handleSelectSlot}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3Confirm
            userId={userId}
            guestReady={guestReady}
            guestName={guestName}
            currentPath={currentPath}
            selectedCourtName={selectedCourt?.name}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            durationOptions={durationOptions}
            selectedDuration={selectedDuration}
            totalPrice={totalPrice}
            error={error}
            isPending={isPending}
            onRetrySlotTaken={handleRetryAfterSlotTaken}
            onSelectDuration={setSelectedDuration}
            onConfirm={handleConfirm}
          />
        )}

        {step === 4 && bookingId && (
          <Step4Payment
            bookingId={bookingId}
            selectedCourtName={selectedCourt?.name}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            selectedDuration={selectedDuration}
            totalPrice={totalPrice}
            userId={userId}
            selectedPaymentMethod={selectedPaymentMethod}
            paymentError={paymentError}
            isPending={isPending}
            onSelectPayment={(method) => {
              setSelectedPaymentMethod(method)
              setPaymentError(null)
            }}
            onConfirmPayment={handleConfirmPayment}
            onBack={() => {
              setStep(3)
              setPaymentError(null)
              setSelectedPaymentMethod(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
