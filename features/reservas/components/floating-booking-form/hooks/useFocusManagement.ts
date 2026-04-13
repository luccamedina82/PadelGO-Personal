import { useRef, useEffect } from 'react'
import type { BookingMode } from '../helpers/formReducer'

interface Params {
  activeSection: string | null
  isQuick: boolean
  bookingMode: BookingMode
  initialMode: 'quick' | 'full'
  isLoadingSlots: boolean
  visibleTimesLength: number
}

export function useFocusManagement({
  activeSection, isQuick, bookingMode, initialMode, isLoadingSlots, visibleTimesLength,
}: Params) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clientNameRef = useRef<HTMLInputElement>(null)
  const firstTimeRef = useRef<HTMLButtonElement>(null)
  const firstCourtRef = useRef<HTMLButtonElement>(null)
  const firstEndTimeRef = useRef<HTMLButtonElement>(null)
  const firstReasonRef = useRef<HTMLButtonElement>(null)

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
          if (bookingMode === 'BLOQUEO') firstReasonRef.current?.focus()
          else clientNameRef.current?.focus()
          break
      }
    }, 160)
    return () => clearTimeout(timer)
  }, [activeSection, isQuick, bookingMode])

  useEffect(() => {
    const timer = setTimeout(() => containerRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (initialMode === 'quick') {
      const timer = setTimeout(() => clientNameRef.current?.focus(), 200)
      return () => clearTimeout(timer)
    }
  }, [initialMode])

  const slotsAutoFocusedRef = useRef(false)
  useEffect(() => {
    if (initialMode !== 'full') return
    if (isLoadingSlots || slotsAutoFocusedRef.current) return
    if (visibleTimesLength > 0) {
      slotsAutoFocusedRef.current = true
      setTimeout(() => firstTimeRef.current?.focus(), 100)
    }
  }, [initialMode, isLoadingSlots, visibleTimesLength])

  return { containerRef, clientNameRef, firstTimeRef, firstCourtRef, firstEndTimeRef, firstReasonRef }
}
