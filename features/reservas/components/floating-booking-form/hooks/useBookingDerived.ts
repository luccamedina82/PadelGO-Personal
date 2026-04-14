import { useMemo, useEffect, useRef } from 'react'
import { calcBookingPrice, timeToMinutes } from '@/lib/availability'
import { getVisibleTimeSlotsForDate } from '../helpers/bookingCalcUtils'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'
import type { FormState, FormAction } from '../helpers/formReducer'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

interface Params {
  form: FormState
  dispatch: React.Dispatch<FormAction>
  courtSlots: FloatingFormCourtSlots[]
  globalDurations: number[]
  baseStart?: number
  baseEnd?: number
  baseBookingRule?: { startTime: string; endTime: string; price: number | null } | null
  courts: CourtColumn[]
  isLoadingSlots: boolean
  showDurationPicker: boolean
}

export function useBookingDerived({
  form, dispatch, courtSlots, globalDurations,
  baseStart, baseEnd, baseBookingRule, courts,
  isLoadingSlots, showDurationPicker,
}: Params) {
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
  const isOOB = !!form.startTime && form.duration > 0 && baseStart !== undefined && baseEnd !== undefined
    && (startMin < baseStart || endMin > baseEnd)

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

  const durationAutoFixedRef = useRef(false)
  useEffect(() => {
    if (!showDurationPicker || isLoadingSlots || durationOptions.length === 0) {
      if (isLoadingSlots) durationAutoFixedRef.current = false
      return
    }
    if (durationAutoFixedRef.current) return
    durationAutoFixedRef.current = true
    // Only correct when duration is too large (or zero). Do NOT correct when
    // form.duration < durationOptions[0] — that means available space is smaller
    // than the minimum allowed duration (e.g. 30 min free, min allowed = 60).
    // Forcing it to 60 would be wrong since 60 doesn't fit either.
    if (!durationOptions.includes(form.duration) && form.duration >= (durationOptions[0] ?? 0)) {
      dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: form.courtId, duration: durationOptions[0] } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDurationPicker, isLoadingSlots, durationOptions])

  return { durationOptions, visibleTimes, allGridTimes, selectedSlot, isOOB, basePrice, courtName, canSubmit }
}
