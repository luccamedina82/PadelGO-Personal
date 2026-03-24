'use client'

import { useCallback } from 'react'
import { toast as sonnerToast } from 'sonner'

export interface ToastData {
  type: 'success' | 'error'
  message: string
}

/** @deprecated Rendering handled by <Toaster /> in layout. This renders nothing. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Toast(_toast: { toast: ToastData }) {
  return null
}

/** Hook to show toasts via sonner. Returns { toast: null, show }. */
export function useToast(durationMs = 3000) {
  const show = useCallback(
    (type: ToastData['type'], message: string) => {
      if (type === 'success') {
        sonnerToast.success(message, { duration: durationMs })
      } else {
        sonnerToast.error(message, { duration: durationMs })
      }
    },
    [durationMs]
  )

  return { toast: null as ToastData | null, show }
}
