import { argTodayStr } from '@/lib/date'
import { timeToMinutes } from '@/lib/availability'

export { argTodayStr as todayLocalStr }

/** Like timeToMinutes but '00:00' → 1440 when used as an end time (midnight = end of day). */
export function endTimeToMinutes(t: string): number {
  const m = timeToMinutes(t)
  return m === 0 ? 24 * 60 : m
}

export function computeEndTime(start: string, durationMins: number): string {
  if (!start) return ''
  const [h = 0, m = 0] = start.split(':').map(Number)
  const total = h * 60 + m + durationMins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function formatDateFull(iso: string): string {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}
