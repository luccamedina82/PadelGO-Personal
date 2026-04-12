import { useMemo } from 'react'
import type { FormState } from '../helpers/formReducer'
import type { FloatingFormInitialData } from '@/app/(owner)/admin/reservas/BookingsClient'

export type SectionId = 'date' | 'time' | 'courtDuration' | 'blockEndTime' | 'clientOrReason' | 'price'

export interface SectionState {
  id: SectionId
  isComplete: boolean
  isActive: boolean
  isVisible: boolean
  isPreFilled: boolean
  isCollapsed: boolean
}

export function useFormSections(
  form: FormState,
  initialData: FloatingFormInitialData,
  isExpanded: boolean,
): { sections: SectionState[]; activeSection: SectionId | null } {
  return useMemo(() => {
    const isQuick = initialData.mode === 'quick' && !isExpanded
    const isBloqueo = form.bookingMode === 'BLOQUEO'

    const raw: Array<{ id: SectionId; complete: boolean; visible: boolean; preFilled: boolean }> = [
      {
        id: 'date',
        complete: !!form.date,
        visible: true,
        preFilled: !!initialData.date,
      },
      {
        id: 'time',
        complete: !!form.startTime,
        visible: !!form.date,
        preFilled: !!initialData.startTime,
      },
      {
        id: 'courtDuration',
        complete: !!form.courtId && form.duration > 0,
        visible: !!form.startTime,
        preFilled: !!initialData.courtId && (initialData.durationMinutes ?? 0) > 0,
      },
      {
        id: 'blockEndTime',
        complete: !!form.blockEndTime,
        visible: isBloqueo && !!form.startTime && !!form.courtId,
        preFilled: false,
      },
      {
        id: 'clientOrReason',
        complete: isBloqueo ? !!form.motivo || !!form.blockEndTime : form.noClient || form.clientName.trim().length > 0,
        visible: isBloqueo
          ? !!form.courtId && !!form.blockEndTime
          : !!form.courtId && form.duration > 0,
        preFilled: false,
      },
      {
        id: 'price',
        complete: true,
        visible: !isBloqueo && !!form.courtId && form.duration > 0,
        preFilled: false,
      },
    ]

    let foundActive = false
    const sections: SectionState[] = raw.map((s) => {
      const isActive = s.visible && !s.complete && !foundActive
      if (isActive) foundActive = true
      return {
        id: s.id,
        isComplete: s.complete,
        isActive,
        isVisible: s.visible,
        isPreFilled: s.preFilled,
        isCollapsed: isQuick && s.preFilled && s.complete,
      }
    })

    const activeSection = sections.find((s) => s.isActive)?.id ?? null
    return { sections, activeSection }
  }, [form, initialData, isExpanded])
}
