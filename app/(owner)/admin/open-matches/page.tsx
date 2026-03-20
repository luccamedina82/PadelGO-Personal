import prisma from '@/lib/prisma'
import { formatPrice } from '@/lib/availability'
import { Role } from '@/app/generated/prisma/browser'
import { getAdminContext } from '@/lib/dal/admin'

export default async function OpenMatchesPage() {
  const { club } = await getAdminContext([Role.OWNER, Role.STAFF])


  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const openMatches = await prisma.booking.findMany({
    where: {
      clubId: club.id,
      isOpenMatch: true,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      durationMinutes: true,
      totalPrice: true,
      spotsAvailable: true,
      requiredLevel: true,
      status: true,
      isOpenMatch: true,
      user: { select: { id: true, name: true, email: true, avatarColor: true } },
      court: { select: { id: true, name: true } },
      playerIds: true,
    },
    orderBy: { date: 'asc' },
  })

  // Get player details for each booking
  const allPlayerIds = [...new Set(openMatches.flatMap((b) => b.playerIds))]
  const playerList =
    allPlayerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allPlayerIds } },
          select: { id: true, name: true, avatarColor: true },
        })
      : []
  const playerMap = new Map(playerList.map((p) => [p.id, p]))

  const mappedMatches = openMatches.map((m) => ({
    ...m,
    players: m.playerIds.map((id) => playerMap.get(id)!).filter(Boolean),
    totalSpots: (m.spotsAvailable ?? 0) + m.playerIds.length,
  }))

  const activeMatches = mappedMatches.filter((m) => m.spotsAvailable! > 0)
  const filledMatches = mappedMatches.filter((m) => m.spotsAvailable! <= 0)

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <div>
          <h1 className="font-semibold text-text">Partidos Abiertos — {club.name}</h1>
          <p className="text-xs text-muted mt-1">
            {activeMatches.length} activo{activeMatches.length !== 1 ? 's' : ''} •{' '}
            {filledMatches.length} completo{filledMatches.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Active matches */}
        {activeMatches.length > 0 && (
          <div>
            <h2 className="font-semibold text-sm text-text mb-3 px-1">
              Con lugares disponibles ({activeMatches.length})
            </h2>
            <div className="space-y-2">
              {activeMatches.map((match) => (
                <OpenMatchCard key={match.id} match={match} clubId={club.id} />
              ))}
            </div>
          </div>
        )}

        {/* Filled matches */}
        {filledMatches.length > 0 && (
          <div>
            <h2 className="font-semibold text-sm text-text mb-3 px-1">
              Completos ({filledMatches.length})
            </h2>
            <div className="space-y-2">
              {filledMatches.map((match) => (
                <OpenMatchCard key={match.id} match={match} clubId={club.id} />
              ))}
            </div>
          </div>
        )}

        {mappedMatches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted">No hay partidos abiertos activos</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface OpenMatchCardProps {
  match: {
    id: string
    date: Date
    startTime: string
    durationMinutes: number
    totalPrice: number
    spotsAvailable: number | null
    requiredLevel: string | null
    status: string
    isOpenMatch: boolean
    user: { id: string; name: string; email: string; avatarColor: string }
    court: { id: string; name: string }
    playerIds: string[]
    players: Array<{ id: string; name: string; avatarColor: string }>
    totalSpots: number
  }
  clubId: string
}

function OpenMatchCard({ match }: OpenMatchCardProps) {
  const dateObj = new Date(`${match.date.toISOString().split('T')[0]}T00:00:00.000Z`)
  const dateStr = dateObj.toLocaleDateString('es-AR')
  const isFilled = match.spotsAvailable! <= 0

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-text truncate">{match.user.name}</p>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isFilled ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'
              }`}
            >
              {isFilled
                ? 'COMPLETO'
                : `${match.spotsAvailable} lugar${match.spotsAvailable !== 1 ? 'es' : ''}`}
            </span>
          </div>
          <p className="text-xs text-muted">
            {dateStr} • {match.startTime} • {match.court.name} • {match.durationMinutes}min
          </p>
          {match.requiredLevel && (
            <p className="text-xs text-muted mt-1">Nivel requerido: {match.requiredLevel}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-bold text-accent text-lg">{formatPrice(match.totalPrice)}</p>
          <p className="text-xs text-muted">
            {match.players.length}/{match.totalSpots} jugadores
          </p>
        </div>
      </div>

      {/* Participants */}
      {match.players.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {match.players.map((player) => (
            <div
              key={player.id}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: player.avatarColor }}
              title={player.name}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
