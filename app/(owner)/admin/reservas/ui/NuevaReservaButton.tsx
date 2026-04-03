'use client'

import { useSearchParams } from 'next/navigation'
import { argTodayStr } from '@/lib/date'

export default function NuevaReservaButton() {
  const searchParams = useSearchParams()
  const currentDate = searchParams.get('date') || argTodayStr()

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    window.dispatchEvent(
      new CustomEvent('reservas:nueva-reserva', {
        detail: { date: currentDate, buttonEl: e.currentTarget },
      })
    )
  }

  return (
    <button
      onClick={handleClick}
      className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-text text-sm font-bold rounded-xl hover:bg-accent-dark transition-colors shadow-sm cursor-pointer"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Nueva reserva
    </button>
  )
}
