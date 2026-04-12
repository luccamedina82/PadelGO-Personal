import { BLOCK_SOURCES } from '@/features/reservas/constants/bookingSources'
export { BLOCK_SOURCES }

export const SLOT_HEIGHT = 64         // px per 30-min row (normal)
export const COMPACT_SLOT_HEIGHT = 36  // px per 30-min row (compact mode)
export const TIME_COL_WIDTH = 52 // px

// Palette for court color indicators (cycles if more than 9 courts)
export const COURT_COLORS: ReadonlyArray<{ bar: string; bg: string; text: string }> = [
  { bar: '#7060d0', bg: 'rgba(112,96,208,0.15)', text: '#a090f0' },
  { bar: '#20a080', bg: 'rgba(32,160,128,0.15)', text: '#40c8b0' },
  { bar: '#a0a000', bg: 'rgba(160,160,0,0.15)',  text: '#d8d840' },
  { bar: '#c03060', bg: 'rgba(192,48,96,0.15)',   text: '#f060a0' },
  { bar: '#2060c0', bg: 'rgba(32,96,192,0.15)',   text: '#5090f0' },
  { bar: '#c06020', bg: 'rgba(192,96,32,0.15)',   text: '#f09040' },
  { bar: '#20a040', bg: 'rgba(32,160,64,0.15)',   text: '#40c870' },
  { bar: '#a020a0', bg: 'rgba(160,32,160,0.15)',  text: '#d060d0' },
  { bar: '#20a0a0', bg: 'rgba(32,160,160,0.15)',  text: '#40c8c8' },
]
export const TOOLTIP_DELAY_MS = 300

export type SourceFilterKey =
  | null
  | 'ONLINE'
  | 'MANUAL'
  | 'BLOCK'
  | 'RECURRING'

export const SOURCE_FILTERS: ReadonlyArray<{ key: SourceFilterKey; label: string }> = [
  { key: null,        label: 'Todos' },
  { key: 'ONLINE',    label: 'Online' },
  { key: 'MANUAL',    label: 'Manual' },
  { key: 'RECURRING', label: 'Turno fijo' },
  { key: 'BLOCK',     label: 'Bloqueo' },
]


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

export function isBlockSource(source: string): boolean {
  return BLOCK_SOURCES.has(source)
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