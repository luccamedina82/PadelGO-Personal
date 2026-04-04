// 1. El Estado Inicial
type BookingMode = 'RESERVA' | 'BLOQUEO'

interface FormState {
  bookingMode: BookingMode
  date: string
  courtId: string
  startTime: string
  duration: number
  clientName: string
  clientPhone: string
  motivo: string
  blockEndTime: string
  oobConfirmed: boolean
  priceOverrideEnabled: boolean
  priceOverrideInput: string
  error: string | null
}

// 2. Las Acciones (Qué cosas pueden pasar en el form)
type FormAction =
  | { type: 'SET_MODE'; payload: BookingMode }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_TIME'; payload: string }
  | { type: 'SET_COURT_DURATION'; payload: { courtId: string; duration: number } }
  // Usamos una acción genérica para los inputs de texto/booleanos simples
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }

// 3. El Reducer (La máquina lógica)
export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_MODE':
      // Cambiar de modo limpia los campos específicos
      return {
        ...state,
        bookingMode: action.payload,
        clientName: '',
        clientPhone: '',
        motivo: '',
        blockEndTime: '',
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null
      }
      
    case 'SET_DATE':
      // Cambiar de fecha resetea todo lo relacionado a los turnos
      return {
        ...state,
        date: action.payload,
        startTime: '',
        courtId: '',
        duration: 0,
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null
      }
      
    case 'SET_TIME':
      // Cambiar la hora resetea la cancha seleccionada
      return {
        ...state,
        startTime: action.payload,
        courtId: '',
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null
      }
      
    case 'SET_COURT_DURATION':
      return {
        ...state,
        courtId: action.payload.courtId,
        duration: action.payload.duration,
        priceOverrideEnabled: false,
        priceOverrideInput: '',
        error: null
      }
      
    case 'SET_FIELD':
      // Para cambiar clientName, motivo, oobConfirmed, etc.
      return {
        ...state,
        [action.field]: action.value
      }

    // EL FIX DEL ERROR ESTÁ ACÁ ABAJO:
    default:
      return state 
  }
}