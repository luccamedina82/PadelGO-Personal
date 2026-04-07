'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  collapsed: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: true,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: 'padelgo-sidebar' }
  )
)
  