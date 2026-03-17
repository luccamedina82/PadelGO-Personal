import ClubCard from './ClubCard'
import type { ClubPublic } from '@/types'

interface ClubGridProps {
  clubs: (ClubPublic & { minPrice: number | null })[]
  emptyMessage?: string
}

export default function ClubGrid({
  clubs,
  emptyMessage = 'No se encontraron clubes.',
}: ClubGridProps) {
  if (clubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-4xl mb-3">🏟️</p>
        <p className="text-muted text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} />
      ))}
    </div>
  )
}
