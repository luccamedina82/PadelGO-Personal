import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import { argDaysAgo } from '@/lib/date'
import ProfileTabs from '@/components/profile/ProfileTabs'
import type { AchievementDisplay, BookingRow, ProfileUser } from '@/components/profile/ProfileTabs'

// ── DATA FETCHING ──────────────────────────────────────────────────────────

async function getProfileData(userId: string) {
  const [user, allAchievements, userAchievements, recentActivity, recentBookings] =
    await Promise.all([
      // User stats
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          avatarUrl: true,
          avatarColor: true,
          zone: true,
          level: true,
          matchesPlayed: true,
          matchesWon: true,
          streak: true,
          lastPlayedAt: true,
        },
      }),

      // All 12 achievement definitions
      prisma.achievement.findMany({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),

      // User's achievement progress
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true, progress: true, unlockedAt: true },
      }),

      // Last 35 days of COMPLETED bookings (for streak calendar)
      prisma.booking.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          date: {
            gte: argDaysAgo(35),
          },
        },
        select: { date: true },
      }),

      // Recent bookings for the Reservas tab (upcoming + latest 15)
      prisma.booking.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 15,
        include: {
          club: { select: { id: true, name: true } },
          court: { select: { name: true } },
        },
      }),
    ])

  return { user, allAchievements, userAchievements, recentActivity, recentBookings }
}

// ── PAGE ───────────────────────────────────────────────────────────────────

export default async function PerfilPage() {
  const session = await requireAuth()
  const { user, allAchievements, userAchievements, recentActivity, recentBookings } =
    await getProfileData(session.userId)

  if (!user) return null

  // Build achievement progress map from UserAchievement table
  const progressMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua]))

  const achievementsDisplay: AchievementDisplay[] = allAchievements.map((a) => {
    const ua = progressMap.get(a.id)
    return {
      key: a.key,
      icon: a.icon,
      name: a.name,
      description: a.description,
      category: a.category,
      total: a.total,
      progress: ua?.progress ?? 0,
      unlockedAt: ua?.unlockedAt ?? null,
    }
  })

  // Activity dates for 35-day calendar
  const activityDates = recentActivity.map((b) => b.date.toISOString().split('T')[0])

  const profileUser: ProfileUser = {
    name: user.name,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
    zone: user.zone,
    level: user.level,
    matchesPlayed: user.matchesPlayed,
    matchesWon: user.matchesWon,
    streak: user.streak,
    lastPlayedAt: user.lastPlayedAt,
  }

  const bookings: BookingRow[] = recentBookings.map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    totalPrice: b.totalPrice,
    status: b.status,
    clubName: b.club.name,
    clubId: b.club.id,
    courtName: b.court.name,
  }))

  return (
    <div className="min-h-screen pb-16">
      <ProfileTabs
        user={profileUser}
        achievements={achievementsDisplay}
        activityDates={activityDates}
        bookings={bookings}
      />
    </div>
  )
}
