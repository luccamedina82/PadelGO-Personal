'use client'

import { create } from 'zustand'

interface Court {
  id: string
  name: string
  colorIndex: number
  isUnderMaintenance: boolean
}

interface ReservasSidebarStore {
  // State synced from the page
  isActive: boolean
  selectedDate: string
  courts: Court[]
  focusCourtIds: string[]
  todayBookingCount: number
  unpaidCount: number
  // Handlers stored as refs (updated on every render via syncHandlers)
  _onDayChange: ((date: string) => void) | null
  _onToggleCourt: ((id: string) => void) | null
  _onClearCourts: (() => void) | null
  // Called from page to initialize/teardown
  activate: () => void
  deactivate: () => void
  // Sync functions — called from page components
  syncDate: (date: string) => void
  syncCourts: (courts: Court[]) => void
  syncFocusCourtIds: (ids: string[]) => void
  syncStats: (bookingCount: number, unpaidCount: number) => void
  syncHandlers: (
    onDayChange: (date: string) => void,
    onToggleCourt: (id: string) => void,
    onClearCourts: () => void,
  ) => void
  // Called from AdminSidebar
  handleDayChange: (date: string) => void
  handleToggleCourt: (id: string) => void
  handleClearCourts: () => void
}

export const useReservasSidebarStore = create<ReservasSidebarStore>()((set, get) => ({
  isActive: false,
  selectedDate: '',
  courts: [],
  focusCourtIds: [],
  todayBookingCount: 0,
  unpaidCount: 0,
  _onDayChange: null,
  _onToggleCourt: null,
  _onClearCourts: null,

  activate: () => set({ isActive: true }),
  deactivate: () => set({
    isActive: false,
    courts: [],
    focusCourtIds: [],
    todayBookingCount: 0,
    unpaidCount: 0,
    _onDayChange: null,
    _onToggleCourt: null,
    _onClearCourts: null,
  }),

  syncDate: (date) => set({ selectedDate: date }),
  syncCourts: (courts) => set({ courts }),
  syncFocusCourtIds: (ids) => set({ focusCourtIds: ids }),
  syncStats: (bookingCount, unpaidCount) => set({ todayBookingCount: bookingCount, unpaidCount }),
  syncHandlers: (onDayChange, onToggleCourt, onClearCourts) =>
    set({ _onDayChange: onDayChange, _onToggleCourt: onToggleCourt, _onClearCourts: onClearCourts }),

  handleDayChange: (date) => get()._onDayChange?.(date),
  handleToggleCourt: (id) => get()._onToggleCourt?.(id),
  handleClearCourts: () => get()._onClearCourts?.(),
}))
