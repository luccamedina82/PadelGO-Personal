'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Silently re-fetches the server component every minute so that
// court status, "canchas libres" and "próximas reservas" stay current.
export default function AdminRefresher() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }, 180_000)
    return () => clearInterval(id)
  }, [router])
  return null
}
