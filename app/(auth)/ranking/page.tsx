import Link from 'next/link'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import { calcRankingPoints, getLevelCategory, formatLevel } from '@/lib/level'
import Avatar from '@/components/ui/Avatar'

// ── TYPES ─────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ tab?: string }>
type PageProps = { searchParams: SearchParams }

interface RankedPlayer {
  id: string
  name: string
  avatarUrl: string | null
  avatarColor: string
  zone: string
  level: number
  matchesPlayed: number
  matchesWon: number
  streak: number
  points: number
  rank: number
}

// ── MEDAL CONFIG ───────────────────────────────────────────────────────────

const MEDAL = ['🥇', '🥈', '🥉']
const PODIUM_HEIGHT = ['h-28', 'h-36', 'h-20'] // 2nd, 1st, 3rd
const PODIUM_LABEL = ['2°', '1°', '3°']

// ── DATA FETCHING ──────────────────────────────────────────────────────────

async function getRanking(
  tab: string,
  userId: string,
  userZone: string
): Promise<{
  top3: RankedPlayer[]
  table: RankedPlayer[]
  currentUserRank: RankedPlayer | null
  total: number
}> {
  const users = await prisma.user.findMany({
    where: {
      role: 'PLAYER',
      isActive: true,
      isBanned: false,
      ...(tab === 'zona' ? { zone: userZone } : {}),
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      avatarColor: true,
      zone: true,
      level: true,
      matchesPlayed: true,
      matchesWon: true,
      streak: true,
    },
    take: 200,
  })

  const ranked: RankedPlayer[] = users
    .map((u) => ({ ...u, points: calcRankingPoints(u) }))
    .sort((a, b) => b.points - a.points || b.level - a.level)
    .map((u, i) => ({ ...u, rank: i + 1 }))

  const top3 = ranked.slice(0, 3)
  const table = ranked.slice(3)
  const currentUserRank = ranked.find((u) => u.id === userId) ?? null

  return { top3, table, currentUserRank, total: ranked.length }
}

// ── PAGE ───────────────────────────────────────────────────────────────────

export default async function RankingPage({ searchParams }: PageProps) {
  const session = await requireAuth()
  const { tab = 'zona' } = await searchParams

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { zone: true },
  })
  if (!currentUser) return null

  const { top3, table, currentUserRank, total } = await getRanking(
    tab,
    session.userId,
    currentUser.zone
  )

  // Podium display order: 2nd · 1st · 3rd (indices in top3: [1, 0, 2])
  const podiumOrder = [1, 0, 2]

  // Determine if current user is already shown in the table (rank > 3)
  const userInTable = currentUserRank && currentUserRank.rank > 3
  const userAlreadyShown = table.some((p) => p.id === session.userId)

  return (
    <div className="min-h-screen px-4 md:px-8 pt-8 pb-16 max-w-[1360px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl tracking-widest text-text">RANKING</h1>
        <p className="text-xs text-muted mt-1">
          {total} jugador{total !== 1 ? 'es' : ''} ·{' '}
          {tab === 'zona' ? currentUser.zone : 'Buenos Aires'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mb-8">
        {[
          { key: 'zona', label: 'Tu Zona' },
          { key: 'ciudad', label: 'Buenos Aires' },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={`/ranking${key !== 'zona' ? `?tab=${key}` : ''}`}
            className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'text-accent border-accent'
                : 'text-muted border-transparent hover:text-text'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {top3.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-muted text-sm">Aún no hay jugadores en este ranking.</p>
        </div>
      )}

      {/* ── Podium ──────────────────────────────────────────────────── */}
      {top3.length >= 1 && (
        <div className="flex items-end justify-center gap-3 mb-10">
          {podiumOrder.map((idx) => {
            const player = top3[idx]
            if (!player) {
              return <div key={`empty-${idx}`} className="w-24" />
            }
            const isFirst = idx === 0
            const isCurrent = player.id === session.userId
            return (
              <div key={player.id} className="flex flex-col items-center w-28">
                {/* Medal */}
                <span className="text-2xl mb-1">{MEDAL[idx]}</span>

                {/* Avatar */}
                <div className={`relative ${isCurrent ? 'ring-2 ring-accent rounded-full' : ''}`}>
                  <Avatar
                    name={player.name}
                    color={player.avatarColor}
                    avatarUrl={player.avatarUrl}
                    size={isFirst ? 'lg' : 'md'}
                  />
                </div>

                {/* Name */}
                <p
                  className={`text-xs font-semibold text-center mt-1 leading-tight truncate w-full text-center ${isCurrent ? 'text-accent' : 'text-text'}`}
                >
                  {player.name.split(' ')[0]}
                </p>

                {/* Level */}
                <p className="font-mono text-xs text-muted">{formatLevel(player.level)}</p>

                {/* Points */}
                <p className="font-mono text-sm font-semibold text-accent mt-0.5">
                  {player.points.toLocaleString('es-AR')} pts
                </p>

                {/* Platform */}
                <div
                  className={`w-full mt-2 rounded-t-lg flex items-center justify-center text-sm font-bold ${
                    isFirst ? 'bg-accent text-accent-text' : 'bg-surface text-muted'
                  } ${PODIUM_HEIGHT[podiumOrder.indexOf(idx)]}`}
                >
                  {PODIUM_LABEL[podiumOrder.indexOf(idx)]}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      {table.length > 0 && (
        <div className="space-y-2">
          {table.map((player) => {
            const isCurrent = player.id === session.userId
            return <PlayerRow key={player.id} player={player} isCurrent={isCurrent} />
          })}
        </div>
      )}

      {/* ── Current user outside visible positions ─────────────────── */}
      {userInTable && !userAlreadyShown && currentUserRank && (
        <>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">Tu posición</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <PlayerRow player={currentUserRank} isCurrent />
        </>
      )}

      {/* If user has no ranking data */}
      {!currentUserRank && (
        <div className="mt-8 text-center">
          <p className="text-xs text-muted">Jugá partidos para aparecer en el ranking.</p>
          <Link
            href="/buscar"
            className="inline-block mt-3 px-4 py-2 bg-accent text-accent-text text-xs font-semibold rounded-xl hover:bg-accent-dark transition-colors"
          >
            Buscar cancha
          </Link>
        </div>
      )}
    </div>
  )
}

// ── PLAYER ROW ─────────────────────────────────────────────────────────────

function PlayerRow({ player, isCurrent }: { player: RankedPlayer; isCurrent: boolean }) {
  const category = getLevelCategory(player.level)

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
        isCurrent ? 'border-accent/40 bg-accent/5' : 'border-border bg-card'
      }`}
    >
      {/* Rank */}
      <span className="font-mono text-sm text-muted w-6 text-right flex-shrink-0">
        {player.rank}
      </span>

      {/* Avatar */}
      <Avatar
        name={player.name}
        color={player.avatarColor}
        avatarUrl={player.avatarUrl}
        size="sm"
      />

      {/* Name + zone */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold leading-none truncate ${isCurrent ? 'text-accent' : 'text-text'}`}
        >
          {player.name}
          {isCurrent && <span className="ml-1 text-xs font-normal text-muted">(vos)</span>}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {player.zone} · {category}
        </p>
      </div>

      {/* Level */}
      <div className="text-right flex-shrink-0">
        <p className="font-mono text-sm font-semibold text-accent">{formatLevel(player.level)}</p>
        <p className="font-mono text-xs text-muted">{player.points.toLocaleString('es-AR')} pts</p>
      </div>
    </div>
  )
}
