export type BookingMode = 'RESERVA' | 'BLOQUEO'

export interface FormState {
  bookingMode: BookingMode
  date: string
  courtId: string
  startTime: string
  duration: number
  clientName: string
  clientPhone: string
  noClient: boolean
  motivo: string
  blockEndTime: string
  oobConfirmed: boolean
  priceOverrideEnabled: boolean
  priceOverrideInput: string
  reasonPreset: string
  error: string | null
}

export type FormAction =
  | { type: 'SET_MODE'; payload: BookingMode }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_TIME'; payload: string }
  | { type: 'SET_COURT_DURATION'; payload: { courtId: string; duration: number } }
  | { type: 'SET_REASON_PRESET'; payload: string }
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        bookingMode: action.payload,
        clientName: '',
        clientPhone: '',
        noClient: false,
        motivo: '',
        blockEndTime: '',
        reasonPreset: '',
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null,
      }

    case 'SET_DATE':
      return {
        ...state,
        date: action.payload,
        startTime: '',
        courtId: '',
        duration: 0,
        noClient: false,
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null,
      }

    case 'SET_TIME':
      return {
        ...state,
        startTime: action.payload,
        courtId: '',
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null,
      }

    case 'SET_COURT_DURATION':
      return {
        ...state,
        courtId: action.payload.courtId,
        duration: action.payload.duration,
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null,
      }

    case 'SET_REASON_PRESET':
      return {
        ...state,
        reasonPreset: action.payload,
        motivo: action.payload,
        error: null,
      }

    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
      }

    default:
      return state
  }
}
