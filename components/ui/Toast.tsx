'use client'

import { useCallback, useState } from 'react'

export interface ToastData {
  type: 'success' | 'error'
  message: string
}

/** Shared toast notification — fixed top-right, auto-dismiss. */
export function Toast({ toast }: { toast: ToastData }) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-xl pointer-events-none ${
        toast.type === 'success'
          ? 'bg-green-400/10 border-green-400/30 text-green-400'
          : 'bg-red-400/10 border-red-400/30 text-red-400'
      }`}
      role="status"
      aria-live="polite"
    >
      {toast.type === 'success' ? '✓ ' : '✕ '}
      {toast.message}
    </div>
  )
}

/** Hook to manage toast state. Returns { toast, show, ToastEl }. */
export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState<ToastData | null>(null)

  const show = useCallback(
    (type: ToastData['type'], message: string) => {
      setToast({ type, message })
      setTimeout(() => setToast(null), durationMs)
    },
    [durationMs]
  )

  return { toast, show }
}
