'use client'

import { useMemo } from 'react'
import DateHeader from './ui/DateHeader/DateHeader'
import NuevaReservaButton from './ui/NuevaReservaButton'
import { useBookingsContext } from './BookingsContext'

interface BookingsHeaderProps {
  clubId: string
  clubName: string
}

export default function BookingsHeader({ clubId, clubName }: BookingsHeaderProps) {
  const { selectedDate, handleDayChange } = useBookingsContext()

  const dateLabel = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00.000Z`)
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  }, [selectedDate])

  return (
    <div className="sticky top-0 z-20 bg-surface border-b border-border print:static print:border-0">
      <div className="pl-4 pr-4 py-2.5 flex items-center gap-3 print:hidden">
        <DateHeader
          selectedDate={selectedDate}
          clubId={clubId}
          onDayChange={handleDayChange}
        />
        <div className="flex-1" />
        <NuevaReservaButton date={selectedDate} />
      </div>
      <div className="hidden print:block px-5 py-3">
        <h1 className="text-lg font-bold capitalize">{dateLabel}</h1>
        <p className="text-sm text-gray-600">{clubName}</p>
      </div>
    </div>
  )
}
