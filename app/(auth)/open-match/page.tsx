import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import { formatLevel, getLevelCategory } from '@/lib/level'
import Avatar from '@/components/ui/Avatar'
import JoinButton from './JoinButton'
import PublishForm, { type UpcomingBooking } from './PublishForm'
import { argToday } from '@/lib/date'

// ── HELPERS ────────────────────────────────────────────────────────────────

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

function formatDateLabel(date: Date): string {
  const day = DAY_SHORT[date.getUTCDay()]
  const dd = date.getUTCDate()
  const month = MONTH_SHORT[date.getUTCMonth()]
  return `${day} ${dd} ${month}`
}

/** Parse "3.0–5.0" level range and check if value is within it */
function isLevelCompatible(requiredLevel: string | null, userLevel: number): boolean {
  if (!requiredLevel) return true
  const parts = requiredLevel.split('–').map((s) => parseFloat(s.trim()))
  if (parts.length !== 2) return true
  return userLevel >= parts[0] && userLevel <= parts[1]
}

// ── PAGE ───────────────────────────────────────────────────────────────────

export default async function OpenMatchPage() {
  const session = await requireAuth()

  const now = argToday()

  const [sessionUser, openMatches, upcomingBookings] = await Promise.all([
    // Current user's level + zone
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { level: true, zone: true },
    }),

    // Open match feed
    prisma.booking.findMany({
      where: {
        isOpenMatch: true,
        status: { in: ['PENDING', 'CONFIRMED'] },
        date: { gte: now },
      },
      orderBy: { date: 'asc' },
      take: 50,
      include: {
        club: { select: { id: true, name: true, zone: true } },
        court: { select: { name: true } },
        user: { select: { id: true, name: true, level: true, avatarUrl: true, avatarColor: true } },
      },
    }),

    // User's upcoming bookings that can be published
    prisma.booking.findMany({
      where: {
        userId: session.userId,
        isOpenMatch: false,
        status: { in: ['PENDING', 'CONFIRMED'] },
        date: { gte: now },
      },
      orderBy: { date: 'asc' },
      take: 10,
      include: {
        club: { select: { name: true } },
        court: { select: { name: true } },
      },
    }),
  ])

  const userLevel = sessionUser?.level ?? 3.0

  // Collect unique participant IDs (excluding hosts — already fetched via include)
  const allPlayerIds = [
    ...new Set(openMatches.flatMap((m) => m.playerIds.filter((id) => id !== m.userId))),
  ]
  const participantUsers =
    allPlayerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allPlayerIds } },
          select: { id: true, name: true, avatarColor: true, avatarUrl: true },
        })
      : []
  const participantMap = new Map(participantUsers.map((u) => [u.id, u]))

  // Build props for PublishForm
  const publishBookings: UpcomingBooking[] = upcomingBookings.map((b) => ({
    id: b.id,
    clubName: b.club.name,
    courtName: b.court.name,
    dateLabel: formatDateLabel(b.date),
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
  }))

  return (
    <div className="min-h-screen px-4 md:px-8 pt-8 pb-16 max-w-[1360px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl tracking-widest text-text">
          TURNOS ABIERTOS
        </h1>
        <p className="text-xs text-muted mt-1">Sumarte a un partido o publicar tu turno</p>
      </div>

      {/* Publish section */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Publicar</p>
        <PublishForm bookings={publishBookings} />
      </div>

      {/* Feed */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
          Partidos disponibles ·{' '}
          {openMatches.length > 0 ? `${openMatches.length} publicados` : 'ninguno'}
        </p>

        {openMatches.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎾</p>
            <p className="text-muted text-sm">No hay turnos abiertos por ahora.</p>
            <p className="text-muted text-xs mt-1">
              Publicá tu turno y encontrá compañeros de juego.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {openMatches.map((match) => {
              const isOwner = match.userId === session.userId
              const alreadyJoined = match.playerIds.includes(session.userId)
              const isFull = (match.spotsAvailable ?? 0) <= 0
              const compatible = isLevelCompatible(match.requiredLevel, userLevel)
              const dateLabel = formatDateLabel(match.date)
              const hostCategory = getLevelCategory(match.user.level)

              // Participants who joined (excluding the host)
              const joinedIds = match.playerIds.filter((id) => id !== match.userId)
              const joinedUsers = joinedIds
                .map((id) => participantMap.get(id))
                .filter(Boolean) as Array<{
                id: string
                name: string
                avatarColor: string
                avatarUrl: string | null
              }>

              return (
                <div
                  key={match.id}
                  className={`bg-card border rounded-2xl p-4 ${
                    compatible && !isOwner ? 'border-border' : 'border-border opacity-70'
                  }`}
                >
                  {/* Top row: host + level tag */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={match.user.name}
                        color={match.user.avatarColor}
                        avatarUrl={match.user.avatarUrl}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-semibold text-text leading-none">
                          {match.user.name.split(' ')[0]}
                          {isOwner && (
                            <span className="ml-1 text-xs font-normal text-muted">(vos)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {formatLevel(match.user.level)} · {hostCategory}
                        </p>
                      </div>
                    </div>

                    {/* Spots badge */}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isFull ? 'bg-surface text-muted' : 'bg-accent/10 text-accent'
                      }`}
                    >
                      {isFull
                        ? 'Completo'
                        : `${match.spotsAvailable} cupo${(match.spotsAvailable ?? 0) > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* Match details */}
                  <div className="text-sm text-text mb-1 font-semibold">{match.club.name}</div>
                  <div className="text-xs text-muted mb-3">
                    {match.court.name} · {dateLabel} · {match.startTime} · {match.durationMinutes}
                    min
                  </div>

                  {/* Participants (joined players) */}
                  {joinedUsers.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-[10px] text-muted mr-0.5">Se sumaron:</span>
                      {joinedUsers.slice(0, 3).map((u) => (
                        <div key={u.id} title={u.name.split(' ')[0]}>
                          <Avatar
                            name={u.name}
                            color={u.avatarColor}
                            avatarUrl={u.avatarUrl}
                            size="xs"
                          />
                        </div>
                      ))}
                      {joinedUsers.length > 3 && (
                        <span className="text-[10px] text-muted">+{joinedUsers.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Level requirement + zone */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {match.requiredLevel && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            compatible
                              ? 'border-accent/40 text-accent bg-accent/5'
                              : 'border-border text-muted bg-surface'
                          }`}
                        >
                          Nivel {match.requiredLevel}
                        </span>
                      )}
                      <span className="text-xs text-muted">{match.club.zone}</span>
                    </div>

                    {/* Action */}
                    {!isOwner && (
                      <JoinButton
                        bookingId={match.id}
                        alreadyJoined={alreadyJoined}
                        isFull={isFull}
                        spotsAvailable={match.spotsAvailable ?? 0}
                      />
                    )}
                    {isOwner && <span className="text-xs text-muted">Tu turno</span>}
                  </div>

                  {/* Incompatible level warning */}
                  {!compatible && !isOwner && (
                    <p className="text-xs text-yellow-400/80 mt-2">
                      Tu nivel ({formatLevel(userLevel)}) está fuera del rango requerido.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
