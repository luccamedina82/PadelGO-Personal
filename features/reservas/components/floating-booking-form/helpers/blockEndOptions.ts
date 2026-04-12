import { timeToMinutes } from '@/lib/availability'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'

export function getBlockEndOptions(
  startTime: string,
  courtId: string,
  courtSlots: FloatingFormCourtSlots[],
  maxMinutes?: number
): string[] {
  const startMin = timeToMinutes(startTime)
  const courtData = courtSlots.find((cs) => cs.courtId === courtId)
  // Allow up to midnight (24:00 = 1440min). 00:00 displayed via % 24 formatting below.
  const cap = maxMinutes ?? 24 * 60

  let maxEnd = Math.min(cap, 24 * 60)
  if (courtData) {
    for (const slot of courtData.slots) {
      if (slot.bookingStartsAt) {
        const slotMin = timeToMinutes(slot.time)
        if (slotMin > startMin && slotMin < maxEnd) maxEnd = slotMin
      }
    }
  }

  const opts: string[] = []
  for (let t = startMin + 30; t <= maxEnd; t += 30) {
    if (t > 24 * 60) break
    const hh = Math.floor(t / 60) % 24
    const mm = t % 60
    opts.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }
  return opts
}
