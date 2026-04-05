'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { argTodayStr, getWeekStart } from '@/lib/date'

// ── Navigation context (selectedDate + weekStart) ────────────────────────────
// Initialized from URL params — no DB data required.
// Week changes are fully client-side (history.pushState), so the grid
// never unmounts or shows a Suspense fallback during navigation.

interface BookingsContextValue {
  selectedDate: string
  weekStart: string
  handleDayChange: (date: string) => void
}

const BookingsContext = createContext<BookingsContextValue | null>(null)

export function useBookingsContext() {
  const ctx = useContext(BookingsContext)
  if (!ctx) throw new Error('useBookingsContext outside BookingsProvider')
  return ctx
}

interface BookingsProviderProps {
  children: ReactNode
  initialSelectedDate: string
  initialWeekStart: string
}

export function BookingsProvider({
  children,
  initialSelectedDate,
  initialWeekStart,
}: BookingsProviderProps) {
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate)
  const [weekStart, setWeekStart] = useState(initialWeekStart)

  // Handle browser back/forward without SSR
  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search)
      const date = params.get('date') ?? argTodayStr()
      setSelectedDate(date)
      setWeekStart(getWeekStart(date))
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  const handleDayChange = useCallback(
    (newDate: string) => {
      const newWeekStart = getWeekStart(newDate)
      setSelectedDate(newDate)
      if (newWeekStart !== weekStart) {
        setWeekStart(newWeekStart)
        window.history.pushState(null, '', `/admin/reservas?date=${newDate}`)
      } else {
        window.history.replaceState(null, '', `/admin/reservas?date=${newDate}`)
      }
    },
    [weekStart]
  )

  return (
    <BookingsContext.Provider value={{ selectedDate, weekStart, handleDayChange }}>
      <div className="h-screen bg-bg flex flex-col">{children}</div>
    </BookingsContext.Provider>
  )
}

// ── Courts context (stable data: courts + rules + conflicts) ─────────────────
// Initialized once from SSR via CourtsProvider (inside the page Suspense).
// Never remounts on week navigation — courts/rules are treated as quasi-static.

interface CourtsContextValue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allCourts: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clubRules: any[]
  conflicts: { id: string; dateStr: string }[]
}

const CourtsContext = createContext<CourtsContextValue | null>(null)

export function useCourtsContext() {
  const ctx = useContext(CourtsContext)
  if (!ctx) throw new Error('useCourtsContext outside CourtsProvider')
  return ctx
}

export function CourtsProvider({
  children,
  allCourts,
  clubRules,
  conflicts,
}: CourtsContextValue & { children: ReactNode }) {
  return (
    <CourtsContext.Provider value={{ allCourts, clubRules, conflicts }}>
      {children}
    </CourtsContext.Provider>
  )
}
