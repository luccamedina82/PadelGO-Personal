'use client'

import { useSidebarStore } from '@/store/sidebarStore'

export default function AdminMain({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarStore((s) => s.collapsed)

  return (
    <main
      className={`flex-1 pb-16 md:pb-0 min-w-0 transition-[margin] duration-200 ${collapsed ? 'md:ml-[60px]' : 'md:ml-[210px]'}`}
    >
      {children}
    </main>
  )
}
