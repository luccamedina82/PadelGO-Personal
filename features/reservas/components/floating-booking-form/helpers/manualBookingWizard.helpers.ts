import { argTodayStr } from '@/lib/date'

export { argTodayStr as todayLocalStr }

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
