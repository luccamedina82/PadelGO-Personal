/**
 * lib/level.ts — Elo-adapted level system for PadelGo.
 *
 * C-01: Zero Next.js imports. Framework-agnostic pure functions.
 *
 * Level range: 1.0 → 10.0 (1 decimal precision).
 * Categories: Principiante → Intermedio → Avanzado → Competitivo → Élite
 */

// ── CONSTANTS ──────────────────────────────────────────────────────────────

/** Elo K-factor — max points gained/lost per match */
const K_FACTOR = 0.5

/** Scale divisor — controls how quickly expected win probability shifts with level diff */
const SCALE_DIVISOR = 4.0

export const LEVEL_MIN = 1.0
export const LEVEL_MAX = 10.0

export type LevelCategory = 'Principiante' | 'Intermedio' | 'Avanzado' | 'Competitivo' | 'Élite'

export interface LevelCategoryDef {
  label: LevelCategory
  min: number
  max: number
  color: string // Tailwind text color token
}

export const LEVEL_CATEGORIES: LevelCategoryDef[] = [
  { label: 'Principiante', min: 1.0, max: 3.0, color: 'text-muted' },
  { label: 'Intermedio', min: 3.1, max: 5.0, color: 'text-accent' },
  { label: 'Avanzado', min: 5.1, max: 7.0, color: 'text-tag-text' },
  { label: 'Competitivo', min: 7.1, max: 9.0, color: 'text-accent' },
  { label: 'Élite', min: 9.1, max: 10.0, color: 'text-accent' },
]

// ── LEVEL HELPERS ──────────────────────────────────────────────────────────

/** Get the category for a given level (1.0–10.0) */
export function getLevelCategory(level: number): LevelCategory {
  const clamped = Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, level))
  for (const cat of LEVEL_CATEGORIES) {
    if (clamped <= cat.max) return cat.label
  }
  return 'Élite'
}

/** Format level to 1 decimal string, e.g. 3.4 */
export function formatLevel(level: number): string {
  return level.toFixed(1)
}

/**
 * Progress within the current integer level step (0–100).
 * e.g. level 3.4 → 40%, level 7.8 → 80%
 */
export function levelProgress(level: number): number {
  const clamped = Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, level))
  if (clamped >= LEVEL_MAX) return 100
  const floor = Math.floor(clamped)
  return Math.round((clamped - floor) * 100)
}

// ── ELO CALCULATION ────────────────────────────────────────────────────────

/**
 * Expected win probability for player vs opponent (Elo formula).
 * @internal
 */
function expectedScore(playerLevel: number, opponentLevel: number): number {
  return 1 / (1 + Math.pow(10, (opponentLevel - playerLevel) / SCALE_DIVISOR))
}

/**
 * Calculate new level after a match result.
 *
 * Rules:
 * - Win vs higher level → more points
 * - Minimum change per match: 0.1
 * - Clamped to [1.0, 10.0]
 */
export function calcNewLevel(currentLevel: number, opponentLevel: number, won: boolean): number {
  const exp = expectedScore(currentLevel, opponentLevel)
  const actual = won ? 1 : 0
  let delta = K_FACTOR * (actual - exp)

  // Round to 1 decimal
  delta = Math.round(delta * 10) / 10

  // Enforce minimum change of 0.1 in the correct direction
  if (delta === 0) {
    delta = won ? 0.1 : -0.1
  }

  const newLevel = currentLevel + delta
  return Math.round(Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, newLevel)) * 10) / 10
}

// ── RANKING POINTS ─────────────────────────────────────────────────────────

export interface RankingUserInput {
  level: number
  matchesPlayed: number
  matchesWon: number
  streak: number
}

/**
 * Calculate ranking points for leaderboard ordering.
 * Formula: level*100 + played*10 + wins*5 + streak*2
 */
export function calcRankingPoints(user: RankingUserInput): number {
  return Math.round(
    user.level * 100 + user.matchesPlayed * 10 + user.matchesWon * 5 + user.streak * 2
  )
}
