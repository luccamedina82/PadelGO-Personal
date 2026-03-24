export const SLOT_HEIGHT = 48 // px per 30-min row
export const TIME_COL_WIDTH = 52 // px
export const TOOLTIP_DELAY_MS = 300

export type SourceFilterKey = null | 'ONLINE' | 'MANUAL' | 'BLOCK' | 'RECURRING'

export const SOURCE_FILTERS: ReadonlyArray<{ key: SourceFilterKey; label: string }> = [
  { key: null, label: 'Todos' },
  { key: 'ONLINE', label: 'Online' },
  { key: 'MANUAL', label: 'Manual' },
  { key: 'BLOCK', label: 'Bloqueo' },
  { key: 'RECURRING', label: 'Turno fijo' },
]

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(centavos / 100)
}

export function getLocalDateStr(): string {
  // Usar timezone ARG para consistencia con el servidor (America/Argentina/Buenos_Aires = UTC-3)
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

export function clampTooltipPosition(
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number
): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: x + 14, y: y + 14 }

  const margin = 8
  const offset = 14
  let nextX = x + offset
  let nextY = y + offset

  const maxX = window.innerWidth - boxWidth - margin
  const maxY = window.innerHeight - boxHeight - margin

  if (nextX > maxX) nextX = Math.max(margin, x - boxWidth - offset)
  if (nextY > maxY) nextY = Math.max(margin, y - boxHeight - offset)

  return {
    x: Math.max(margin, nextX),
    y: Math.max(margin, nextY),
  }
}

export function getBlockClass(
  source: string,
  status: string,
  recurringBookingId?: string | null
): string {
  if (status === 'CANCELLED') return 'booking-block-cancelled'
  if (source === 'BLOCK' && recurringBookingId) return 'booking-block-recurring'
  if (source === 'BLOCK') return 'booking-block-block'
  if (source === 'ONLINE') return 'booking-block-online'
  return 'booking-block-manual'
}

export function getSourceLabel(
  source: string,
  status: string,
  recurringBookingId?: string | null
): string {
  if (status === 'CANCELLED') return 'CANCEL'
  if (source === 'BLOCK' && recurringBookingId) return 'TURNO FIJO'
  if (source === 'BLOCK') return 'BLOQUEO'
  if (source === 'ONLINE') return 'ONLINE'
  return 'MANUAL'
}

export function shouldUpdateTooltipPosition(
  prevX: number,
  prevY: number,
  nextX: number,
  nextY: number,
  threshold = 6
): boolean {
  return Math.abs(prevX - nextX) >= threshold || Math.abs(prevY - nextY) >= threshold
}