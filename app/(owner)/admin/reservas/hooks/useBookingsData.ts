'use client'

import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays } from '@/lib/date'
import { type BookingRuleInput } from '@/lib/availability'
import { prepareGridData } from '@/lib/utils/gridHelpers'
import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import type { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

export type DayGridData = {
  courtColumns: CourtColumn[]
  baseStart: number
  baseEnd: number
  baseBookingRule: {
    startTime: string
    endTime: string
    price: number | null
    allowedDurations?: number[]
  } | null
}

function findBaseRuleForDay(clubRules: BookingRuleInput[], dayStr: string) {
  const dayStart = new Date(`${dayStr}T00:00:00.000Z`)
  const dayEnd = new Date(`${dayStr}T23:59:59.999Z`)
  const baseRules = clubRules
    .filter((r) => r.priority === 0)
    .sort((a, b) => {
      const at = a.activeFrom ? new Date(a.activeFrom).getTime() : 0
      const bt = b.activeFrom ? new Date(b.activeFrom).getTime() : 0
      return bt - at
    })
  return (
    baseRules.find((r) => {
      const from = r.activeFrom ? new Date(r.activeFrom) : null
      const until = r.activeUntil ? new Date(r.activeUntil) : null
      return (from == null || from <= dayEnd) && (until == null || until >= dayStart)
    }) ?? null
  )
}

type UseBookingsDataParams = {
  clubId: string
  weekStart: string
  selectedDate: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allCourts: any[]
  clubRules: BookingRuleInput[]
  initialBookings: BookingBlock[]
  initialWeekStart: string
}

type UseBookingsDataResult = {
  bookings: BookingBlock[]
  isFetching: boolean
  weekData: Record<string, DayGridData>
}

export function useBookingsData({
  clubId,
  weekStart,
  selectedDate,
  allCourts,
  clubRules,
  initialBookings,
  initialWeekStart,
}: UseBookingsDataParams): UseBookingsDataResult {
  const queryClient = useQueryClient()
  const [initialDataTimestamp] = useState(() => Date.now())

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const weekData = useMemo<Record<string, DayGridData>>(() => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const data: Record<string, DayGridData> = {}
    weekDays.forEach((day) => {
      const dayOfWeek = new Date(`${day}T00:00:00.000Z`).getUTCDay()
      const rule = findBaseRuleForDay(clubRules, day)
      const { courtColumns, baseStart, baseEnd } = prepareGridData(allCourts, clubRules, rule, dayOfWeek)
      data[day] = {
        courtColumns,
        baseStart,
        baseEnd,
        baseBookingRule: rule
          ? {
              startTime: rule.startTime,
              endTime: rule.endTime,
              price: rule.price,
              allowedDurations: rule.allowedDurations,
            }
          : null,
      }
    })
    return data
  }, [weekStart, allCourts, clubRules])

  const { data: allWeekBookings, isFetching } = useQuery({
    queryKey: ['bookings', clubId, 'week', weekStart],
    queryFn: () => fetchBookingsAction(clubId, weekStart, weekEnd),
    initialData: weekStart === initialWeekStart ? initialBookings : undefined,
    initialDataUpdatedAt: weekStart === initialWeekStart ? initialDataTimestamp : undefined,
    refetchInterval: 30_000,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const bookings = useMemo(
    () => (allWeekBookings ?? []).filter((b) => b.date === selectedDate),
    [allWeekBookings, selectedDate]
  )

  useEffect(() => {
    const prevStart = addDays(weekStart, -7)
    const nextStart = addDays(weekStart, 7)
    queryClient.prefetchQuery({
      queryKey: ['bookings', clubId, 'week', prevStart],
      queryFn: () => fetchBookingsAction(clubId, prevStart, addDays(prevStart, 6)),
      staleTime: 5 * 60 * 1000,
    })
    queryClient.prefetchQuery({
      queryKey: ['bookings', clubId, 'week', nextStart],
      queryFn: () => fetchBookingsAction(clubId, nextStart, addDays(nextStart, 6)),
      staleTime: 5 * 60 * 1000,
    })
  }, [weekStart, clubId, queryClient])

  return { bookings, isFetching, weekData }
}
