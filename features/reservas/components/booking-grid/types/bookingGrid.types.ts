export interface BookingBlock {
  id: string
  clubId?: string
  courtId: string
  startTime: string // 'HH:MM'
  durationMinutes: number
  status: string // 'CONFIRMED' | 'PENDING' | 'CANCELLED'
  source: string // 'ONLINE' | 'MANUAL_OWNER' | 'MANUAL_SUPPORT' | 'BLOCK'
  displayName: string // manualName, user name, or 'Bloqueo'
  totalPrice: number // centavos
  paymentStatus: string
  manualPhone?: string | null
  recurringBookingId?: string | null
  playerDetails?: { id: string; name: string }[]
  paidPlayerIds?: string[]
  date: string // YYYY-MM-DD, populated in week view
}

export interface CourtColumn {
  id: string
  name: string
  isActive: boolean
}

export interface UpdateBookingData {
  startTime: string
  durationMinutes: number
  manualName?: string
  manualPhone?: string
}

export interface BookingGridProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  date: string // YYYY-MM-DD
  gridStart: number // minutes from midnight, e.g. 7*60 = 420
  gridEnd: number // minutes from midnight, e.g. 23*60 = 1380
  onCancelBooking?: (bookingId: string) => Promise<void>
  onConfirmBooking?: (bookingId: string) => Promise<void>
  onUpdatePayment?: (bookingId: string, status: 'PAID' | 'UNPAID' | 'MANUAL') => Promise<void>
  onUpdateBooking?: (bookingId: string, data: UpdateBookingData) => Promise<void>
  onUpdatePlayers?: (
    bookingId: string,
    playerIds: string[],
    paidPlayerIds: string[]
  ) => Promise<void>
  onSearchPlayers?: (query: string) => Promise<{ id: string; name: string }[]>
  highlightBookingId?: string
}