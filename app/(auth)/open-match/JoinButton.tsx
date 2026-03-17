'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { joinOpenMatch } from '@/actions/openMatch'

interface JoinButtonProps {
  bookingId: string
  alreadyJoined: boolean
  isFull: boolean
  spotsAvailable: number
}

export default function JoinButton({
  bookingId,
  alreadyJoined,
  isFull,
  spotsAvailable,
}: JoinButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [spotsLeft, setSpotsLeft] = useState(spotsAvailable)

  if (alreadyJoined || joined) {
    return (
      <div className="text-right">
        <span className="text-xs font-semibold text-green-400">✓ Anotado</span>
        {spotsLeft > 0 && (
          <p className="text-[10px] text-muted mt-0.5">
            {spotsLeft} cupo{spotsLeft > 1 ? 's' : ''} restante{spotsLeft > 1 ? 's' : ''}
          </p>
        )}
      </div>
    )
  }

  if (isFull) {
    return <span className="text-xs text-muted">Sin cupos</span>
  }

  function handleJoin() {
    setError(null)
    startTransition(async () => {
      const result = await joinOpenMatch(bookingId)
      if (!result.success) setError(result.error)
      else {
        setSpotsLeft((prev) => Math.max(0, prev - 1))
        setJoined(true)
        router.refresh()
      }
    })
  }

  return (
    <div className="text-right">
      {error && <p className="text-xs text-red-400 mb-1 max-w-[160px] text-right">{error}</p>}
      <button
        onClick={handleJoin}
        disabled={isPending}
        className="px-3 py-1.5 bg-accent text-accent-text text-xs font-semibold rounded-xl disabled:opacity-50 hover:bg-accent-dark transition-colors"
      >
        {isPending ? '…' : 'Sumarme'}
      </button>
    </div>
  )
}
