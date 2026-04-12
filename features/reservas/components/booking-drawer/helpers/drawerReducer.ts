import { argTodayStr } from '@/lib/date'

export type DrawerStep = 0 | 1 | 2 | 3

export interface DrawerState {
  step: DrawerStep
  date: string
  startTime: string
  duration: number
  courtId: string
  clientName: string
  clientPhone: string
  noClient: boolean
  bookingMode: 'RESERVA' | 'BLOQUEO'
  motivo: string
  reasonPreset: string
  error: string | null
}

export type DrawerAction =
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_TIME'; payload: string }
  | { type: 'SET_COURT'; payload: string }
  | { type: 'GO_STEP'; payload: DrawerStep }
  | { type: 'SET_FIELD'; field: 'clientName' | 'clientPhone' | 'motivo' | 'reasonPreset'; value: string }
  | { type: 'SET_NO_CLIENT'; payload: boolean }
  | { type: 'SET_BOOKING_MODE'; payload: 'RESERVA' | 'BLOQUEO' }
  | { type: 'SET_ERROR'; payload: string | null }

interface DrawerPrefill {
  courtId?: string
  startTime?: string
  duration?: number
}

export function initialDrawerState(date: string, prefill?: DrawerPrefill): DrawerState {
  const hasPrefill = !!(prefill?.courtId && prefill?.startTime && prefill?.duration)
  return {
    step: hasPrefill ? 3 : 0,
    date,
    startTime: prefill?.startTime ?? '',
    duration: prefill?.duration ?? 60,
    courtId: prefill?.courtId ?? '',
    clientName: '',
    clientPhone: '',
    noClient: false,
    bookingMode: 'RESERVA',
    motivo: '',
    reasonPreset: '',
    error: null,
  }
}

export function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, date: action.date, startTime: '', courtId: '', step: 1 }
    case 'SET_DURATION':
      return { ...state, duration: action.payload, startTime: '', courtId: '' }
    case 'SET_TIME':
      return { ...state, startTime: action.payload, courtId: '', step: 2 }
    case 'SET_COURT':
      return { ...state, courtId: action.payload, step: 3 }
    case 'GO_STEP':
      return { ...state, step: action.payload }
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'SET_NO_CLIENT':
      return { ...state, noClient: action.payload, clientName: action.payload ? '' : state.clientName }
    case 'SET_BOOKING_MODE':
      return { ...state, bookingMode: action.payload, motivo: '', reasonPreset: '', startTime: '', duration: 60, courtId: '', step: state.step > 0 ? 1 : 0 }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    default:
      return state
  }
}
