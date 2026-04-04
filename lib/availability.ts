/**
 * lib/availability.ts — Court slot availability calculator.
 *
 * C-01: Zero Next.js imports. Framework-agnostic pure functions.
 * All logic is pure: receives data as parameters, returns results.
 */

import type { TimeSlot } from '@/types'

// ── CONSTANTS ──────────────────────────────────────────────────────────────

export type DurationMinutes = number
/** Minimum minutes ahead of now to allow a booking */
export const MIN_ADVANCE_MINUTES = 60

/** Base grid increment for admin mode (never changes — grid UI depends on this) */
const ADMIN_SLOT_INCREMENT = 30

// ── TIME HELPERS ──────────────────────────────────────────────────────────

/** "HH:MM" → minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

/** minutes from midnight → "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// ── INTERFACES ────────────────────────────────────────────────────────────

export interface ExistingBooking {
  startTime: string // "HH:MM"
  durationMinutes: number
  status: string // "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
}

/** A single booking rule as received from the DAL */
export interface BookingRuleInput {
  name: string
  priority: number
  courtIds: string[]
  daysOfWeek: number[] // [0..6]
  startTime: string // "HH:MM" — block start
  endTime: string // "HH:MM" — block end (exclusive)
  price: number | null // centavos; null = inherit from CourtAvailability.pricePerHour
  intervalMinutes: number // slot granularity for player UI
  allowedDurations: number[] // e.g. [60, 90]
  activeFrom?: Date | null // null = always valid from the start
  activeUntil?: Date | null // null = no expiry
}

/** The resolved rule for a specific slot after cascade evaluation */
export interface ResolvedRule {
  ruleName: string
  price: number
  intervalMinutes: number
  allowedDurations: number[]
}

export interface AvailabilityConfig {
  openTime: string // "08:00"
  closeTime: string // "22:00"
  pricePerHour: number // centavos ARS (fallback when no rule defines a price)
  rules?: BookingRuleInput[] // combined club-wide + court-specific rules
  isUnderMaintenance?: boolean
}

// ── RULES ENGINE ──────────────────────────────────────────────────────────

/**
 * Resolve the winning BookingRule for a specific slot via priority cascade.
 *
 * Cascade logic:
 *   1. Filter rules that cover dayOfWeek AND the slot's start minute falls within
 *      [rule.startTime, rule.endTime).
 *   2. Sort by priority DESC — highest priority wins.
 *   3. The highest-priority matching rule supplies intervalMinutes and allowedDurations.
 *   4. price: taken from the highest-priority rule that has price !== null.
 *      If no rule supplies a price, fallbackPricePerHour is used.
 *
 * Returns null when no rules match (caller uses raw CourtAvailability values).
 */
export function resolveBookingRule(
  rules: BookingRuleInput[],
  dayOfWeek: number,
  slotStartMinutes: number,
  fallbackPricePerHour: number
): ResolvedRule | null {
  const matching = rules
    .filter(
      (r) =>
        r.daysOfWeek.includes(dayOfWeek) &&
        slotStartMinutes >= timeToMinutes(r.startTime) &&
        slotStartMinutes < timeToMinutes(r.endTime)
    )
    .sort((a, b) => b.priority - a.priority)

  if (matching.length === 0) return null

  const top = matching[0]!

  const priceRule = matching.find((r) => r.price !== null)
  const price = priceRule?.price ?? fallbackPricePerHour

  return {
    ruleName: top.name,
    price,
    intervalMinutes: top.intervalMinutes,
    allowedDurations: top.allowedDurations,
  }
}

// ── MAIN FUNCTION ─────────────────────────────────────────────────────────

/**
 * Calculate bookable time slots for a given court, date, and existing bookings.
 *
 * Rules:
 * - Admin mode: 30-min grid increments always (grid UI depends on ADMIN_SLOT_INCREMENT).
 *   Rules supply price and allowedDurations but NOT interval filtering.
 * - Player mode: slot increment = resolved.intervalMinutes (e.g. 60 min hides :30 slots).
 * - Active bookings (PENDING/CONFIRMED) block their time range.
 * - Slots within minAdvanceMinutes of `now` are marked unavailable (same-day only).
 *
 * @param config           Availability config + optional rules array
 * @param existingBookings Bookings already created for that court + date
 * @param selectedDate     The date being queried (UTC midnight)
 * @param now              Reference "now" — defaults to new Date() (injectable for tests)
 * @param minAdvanceMinutes Minimum minutes ahead of now required (0 for admin)
 * @param mode             'admin' keeps 30-min grid; 'player' respects rule intervalMinutes
 */
export function calcAvailableSlots(
  config: AvailabilityConfig,
  existingBookings: ExistingBooking[],
  selectedDate: Date,
  now: Date = new Date(),
  minAdvanceMinutes: number = MIN_ADVANCE_MINUTES,
  mode: 'admin' | 'player' = 'player'
): TimeSlot[] {
  if (config.isUnderMaintenance) return []

  const openMinutes = timeToMinutes(config.openTime)
  const closeMinutes = timeToMinutes(config.closeTime)
  const rules = config.rules ?? []

  // Pre-filter rules by temporal validity for the queried date
  const dateRules = rules.filter((r) => {
    if (!r.activeFrom && !r.activeUntil) return true
    if (r.activeFrom && selectedDate < r.activeFrom) return false
    if (r.activeUntil && selectedDate > r.activeUntil) return false
    return true
  })

  const activeBookings = existingBookings.filter(
    (b) => b.status === 'PENDING' || b.status === 'CONFIRMED'
  )

  // Same-day advance check: compare dates in Argentina timezone
  const bookingDateStr = [
    selectedDate.getUTCFullYear(),
    String(selectedDate.getUTCMonth() + 1).padStart(2, '0'),
    String(selectedDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const nowArgDateStr = now.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const isSameDay = bookingDateStr === nowArgDateStr

  const nowTimeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const [nh, nm] = nowTimeStr.split(':').map(Number)
  const nowMinutes = (nh ?? 0) * 60 + (nm ?? 0)

  const dayOfWeek = selectedDate.getUTCDay()
  const slots: TimeSlot[] = []

  for (let start = openMinutes; start <= closeMinutes - 60; start += ADMIN_SLOT_INCREMENT) {
    // Resolve the winning rule for this slot position
    const resolved = resolveBookingRule(dateRules, dayOfWeek, start, config.pricePerHour)
    if (!resolved) continue
    const effectivePrice = resolved?.price ?? config.pricePerHour
    const effectiveDurations = resolved.allowedDurations
    const effectiveInterval = resolved?.intervalMinutes ?? ADMIN_SLOT_INCREMENT
    const appliedRuleName = resolved?.ruleName

    // Player mode: skip slots not aligned with the rule's intervalMinutes
    if (mode === 'player' && start !== openMinutes && start % effectiveInterval !== 0) {
      continue
    }

    // Which durations fit before closeTime?
    const durationOptions = (effectiveDurations as readonly number[]).filter(
      (d) => start + d <= closeMinutes
    ) as number[]

    if (durationOptions.length === 0) continue

    const isTooSoon = isSameDay && start < nowMinutes + minAdvanceMinutes

    const availableDurations = durationOptions.filter((d) => {
      const slotEnd = start + d
      return !activeBookings.some((booking) => {
        const bStart = timeToMinutes(booking.startTime)
        const bEnd = bStart + booking.durationMinutes
        return start < bEnd && slotEnd > bStart
      })
    })

    const available = !isTooSoon && availableDurations.length > 0

    slots.push({
      time: minutesToTime(start),
      endTime: minutesToTime(start + (durationOptions[0] ?? 60)),
      pricePerHour: effectivePrice,
      available,
      durationOptions: available ? availableDurations : [],
      appliedRuleName,
    })
  }

  return slots
}

// ── PRICE HELPERS ─────────────────────────────────────────────────────────

/** Calculate total booking price in centavos (C-08) */
export function calcBookingPrice(pricePerHour: number, durationMinutes: number): number {
  return Math.round((pricePerHour / 60) * durationMinutes)
}

/** Format centavos → ARS currency string for display */
export function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

/** Format price per hour for display (e.g. "$7.000/hr") */
export function formatPricePerHour(pricePerHour: number): string {
  return `${formatPrice(pricePerHour)}/hr`
}
