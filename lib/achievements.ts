/**
 * lib/achievements.ts — Achievement evaluation for PadelGo.
 *
 * C-01: Zero Next.js imports. Framework-agnostic pure functions.
 *
 * Evaluates which achievements a user has newly unlocked or progressed on
 * based on their current stats. Called inside a `$transaction` after a match.
 */

// ── TYPES ──────────────────────────────────────────────────────────────────

/** Context snapshot used to evaluate all achievements */
export interface AchievementContext {
  matchesPlayed: number
  level: number
  streak: number
  uniqueClubCount: number // count of distinct clubs ever booked
  isOpenMatchHost: boolean // has ever created an open match
  hasInvitedFriend: boolean // has playerIds > 1 in any booking
  zoneRank: number // current rank in their zone (0 = unknown)
}

export interface AchievementProgress {
  key: string
  progress: number
  unlock: boolean // should be unlocked right now
}

// ── ACHIEVEMENTS REGISTRY ──────────────────────────────────────────────────

/**
 * Evaluates all 12 achievements and returns the current progress state
 * for each. The caller is responsible for comparing against existing unlocks
 * and only inserting NEW ones inside the transaction.
 *
 * Returns progress in [0, total] for the achievement's `total` field.
 */
export function evaluateAchievements(ctx: AchievementContext): AchievementProgress[] {
  return [
    // ── INICIO ──────────────────────────────────────────────────
    {
      key: 'first_booking',
      progress: Math.min(ctx.matchesPlayed, 1),
      unlock: ctx.matchesPlayed >= 1,
    },
    {
      key: 'tenth_booking',
      progress: Math.min(ctx.matchesPlayed, 10),
      unlock: ctx.matchesPlayed >= 10,
    },

    // ── CONSTANCIA ───────────────────────────────────────────────
    {
      key: 'streak_7',
      progress: Math.min(ctx.streak, 7),
      unlock: ctx.streak >= 7,
    },
    {
      key: 'streak_30',
      progress: Math.min(ctx.streak, 30),
      unlock: ctx.streak >= 30,
    },

    // ── EXPLORADOR ────────────────────────────────────────────────
    {
      key: 'three_clubs',
      progress: Math.min(ctx.uniqueClubCount, 3),
      unlock: ctx.uniqueClubCount >= 3,
    },
    {
      key: 'five_clubs',
      progress: Math.min(ctx.uniqueClubCount, 5),
      unlock: ctx.uniqueClubCount >= 5,
    },

    // ── SOCIAL ────────────────────────────────────────────────────
    {
      key: 'invite_friend',
      progress: ctx.hasInvitedFriend ? 1 : 0,
      unlock: ctx.hasInvitedFriend,
    },
    {
      key: 'open_match_host',
      progress: ctx.isOpenMatchHost ? 1 : 0,
      unlock: ctx.isOpenMatchHost,
    },

    // ── NIVEL ─────────────────────────────────────────────────────
    {
      key: 'level_5',
      progress: Math.min(ctx.level, 5),
      unlock: ctx.level >= 5.0,
    },
    {
      key: 'level_8',
      progress: Math.min(ctx.level, 8),
      unlock: ctx.level >= 8.0,
    },

    // ── RANKING ───────────────────────────────────────────────────
    {
      key: 'top10_zone',
      progress: ctx.zoneRank > 0 && ctx.zoneRank <= 10 ? 10 : Math.max(0, 10 - ctx.zoneRank),
      unlock: ctx.zoneRank > 0 && ctx.zoneRank <= 10,
    },

    // ── ESPECIAL ──────────────────────────────────────────────────
    {
      key: 'hundred_matches',
      progress: Math.min(ctx.matchesPlayed, 100),
      unlock: ctx.matchesPlayed >= 100,
    },
  ]
}

/**
 * Compare evaluated achievements against already-unlocked keys.
 * Returns achievements that are newly unlocked and should be inserted.
 */
export function getNewUnlocks(
  evaluated: AchievementProgress[],
  alreadyUnlocked: Set<string>
): AchievementProgress[] {
  return evaluated.filter((a) => a.unlock && !alreadyUnlocked.has(a.key))
}
