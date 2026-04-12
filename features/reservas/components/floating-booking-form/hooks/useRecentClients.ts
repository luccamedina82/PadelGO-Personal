import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'padel_recent_clients'
const MAX_RECENT = 4

export interface RecentClient {
  name: string
  phone?: string
}

export function useRecentClients() {
  const [recentClients, setRecentClients] = useState<RecentClient[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setRecentClients(JSON.parse(raw))
    } catch {}
  }, [])

  const saveClient = useCallback((name: string, phone?: string) => {
    if (!name.trim()) return
    setRecentClients((prev) => {
      const entry: RecentClient = { name: name.trim(), phone: phone?.trim() || undefined }
      const filtered = prev.filter((c) => c.name.toLowerCase() !== entry.name.toLowerCase())
      const next = [entry, ...filtered].slice(0, MAX_RECENT)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { recentClients, saveClient }
}
