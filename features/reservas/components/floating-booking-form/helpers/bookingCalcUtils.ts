interface CourtSlots {
  courtId: string
  slots: {
    time: string
    available: boolean
    durationOptions: number[]
    pricePerHour: number
    appliedRuleName?: string
  }[]
}

/**
 * Counts the total available slots per date across all courts.
 * Returns Record<'YYYY-MM-DD', number> for calendar heat-map rendering.
 */
export function calcDateSlotCounts(
  courtSlotsByDate: Record<string, CourtSlots[]>
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [date, courts] of Object.entries(courtSlotsByDate)) {
    let count = 0
    for (const cs of courts) {
      for (const slot of cs.slots) {
        if (slot.available) count++
      }
    }
    result[date] = count
  }
  return result
}

/**
 * Returns the duration options that are actually available for a specific court
 * at a given start time (i.e., the slot exists, is available, and supports that duration).
 */
export function getAvailableDurationsForCourt(
  time: string,
  courtId: string,
  allCourtSlots: CourtSlots[],
  durationOptions: number[]
): number[] {
  const cs = allCourtSlots.find((x) => x.courtId === courtId)
  const slot = cs?.slots.find((s) => s.time === time)
  if (!slot?.available) return []
  return durationOptions.filter((d) => slot.durationOptions.includes(d))
}

/**
 * Returns only the times where at least one court has an available slot with
 * at least one duration in common with the global durationOptions.
 * Strips fully-booked slots so the time grid only shows actionable options.
 */
export function getVisibleTimeSlotsForDate(
  allCourtSlots: CourtSlots[],
  durationOptions: number[]
): string[] {
  const timeSet = new Set<string>()
  for (const cs of allCourtSlots) {
    for (const slot of cs.slots) {
      if (
        slot.available &&
        (durationOptions.length === 0 ||
          slot.durationOptions.some((d) => durationOptions.includes(d)))
      ) {
        timeSet.add(slot.time)
      }
    }
  }
  return Array.from(timeSet).sort()
}
