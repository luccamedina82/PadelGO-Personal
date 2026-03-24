import { argToday } from '@/lib/date'
import type { Period } from '../types/bookingWizard.types'

export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function buildDates(): Date[] {
  const today = argToday()
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() + i)
    return d
  })
}

export const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

export const DURATION_LABELS: Record<number, string> = {
  60: '1h',
  90: '1h 30m',
  120: '2h',
}

export const STEPS = ['Fecha', 'Horario', 'Confirmar', 'Pago'] as const

export function slotPeriod(time: string): Period {
  const [h] = time.split(':').map(Number)
  if (h < 12) return 'Mañana'
  if (h < 19) return 'Tarde'
  return 'Noche'
}