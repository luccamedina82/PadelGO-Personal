import { useCallback } from 'react'
import { timeToMinutes } from '@/lib/availability'
import { computeEndTime, endTimeToMinutes } from '../helpers/manualBookingWizard.helpers'
import type { FormState, FormAction, BookingMode } from '../helpers/formReducer'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'

interface Params {
  form: FormState
  dispatch: React.Dispatch<FormAction>
  courtSlots: FloatingFormCourtSlots[]
}

export function useFormHandlers({ form, dispatch, courtSlots }: Params) {
  const handleModeChange = useCallback((m: BookingMode) => {
    dispatch({ type: 'SET_MODE', payload: m })
    if (m === 'BLOQUEO' && form.startTime && form.duration > 0) {
      dispatch({ type: 'SET_FIELD', field: 'blockEndTime', value: computeEndTime(form.startTime, form.duration) })
    }
  }, [form.startTime, form.duration, dispatch])

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
  }, [form.bookingMode, form.duration, courtSlots, dispatch])

  const handleBlockEndTimeChange = useCallback((endT: string) => {
    dispatch({ type: 'SET_FIELD', field: 'blockEndTime', value: endT })
    if (form.startTime && endT) {
      const dur = endTimeToMinutes(endT) - timeToMinutes(form.startTime)
      if (dur > 0) dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: form.courtId, duration: dur } })
    }
  }, [form.startTime, form.courtId, dispatch])

  const handleReasonPreset = useCallback((preset: string) => {
    if (preset === '__custom__') {
      dispatch({ type: 'SET_FIELD', field: 'reasonPreset', value: '__custom__' })
      dispatch({ type: 'SET_FIELD', field: 'motivo', value: '' })
    } else {
      dispatch({ type: 'SET_REASON_PRESET', payload: preset })
    }
  }, [dispatch])

  const handleCustomReason = useCallback((val: string) => {
    dispatch({ type: 'SET_FIELD', field: 'motivo', value: val })
  }, [dispatch])

  return { handleModeChange, handleSelectTime, handleBlockEndTimeChange, handleReasonPreset, handleCustomReason }
}
