// ── ENUMS (mirror of Prisma enums — TypeScript pure) ─────────────────────
export type Role = 'SUPERADMIN' | 'OWNER' | 'STAFF' | 'PLAYER'
export type CourtType = 'CRISTAL' | 'MURO' | 'PANORAMICA'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'MANUAL'
export type BookingSource = 'ONLINE' | 'MANUAL_STAFF' | 'MANUAL_SUPPORT' | 'BLOCK'
export type AchievementCat =
  | 'INICIO'
  | 'CONSTANCIA'
  | 'EXPLORADOR'
  | 'SOCIAL'
  | 'NIVEL'
  | 'RANKING'
  | 'ESPECIAL'
export type AuditAction =
  | 'CREATE_CLUB'
  | 'UPDATE_CLUB'
  | 'ACTIVATE_CLUB'
  | 'DEACTIVATE_CLUB'
  | 'CREATE_COURT'
  | 'UPDATE_COURT'
  | 'CANCEL_BOOKING'
  | 'DEACTIVATE_USER'
  | 'ACTIVATE_USER'
  | 'BAN_USER'
  | 'UNBAN_USER'
  | 'RESET_USER_PASSWORD'
  | 'UPDATE_CLUB_AVAILABILITY'
  | 'INVITE_STAFF'
  | 'REMOVE_STAFF'
  | 'CREATE_MANUAL_BOOKING'
export type BarCategory = 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO'
export type PayMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'POSNET'

// ── SHARED PUBLIC TYPES ───────────────────────────────────────────────────

/** Safe user data — no password, no sensitive fields */
export interface UserPublic {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  avatarColor: string
  zone: string
  level: number
  matchesPlayed: number
  matchesWon: number
  streak: number
  lastPlayedAt?: Date | null
  role: Role
  isActive: boolean
  isBanned: boolean
  isGhost: boolean
  staffClubId?: string | null
  createdAt: Date
}

export interface CourtAvailabilitySlot {
  id: string
  courtId: string
  dayOfWeek: number // 0=Sun ... 6=Sat
  openTime: string // "08:00"
  closeTime: string // "22:00"
  pricePerHour: number // centavos ARS
  isActive: boolean
}

export interface CourtWithAvailability {
  id: string
  clubId: string
  name: string
  type: CourtType
  covered: boolean
  svgX: number
  svgY: number
  svgW: number
  svgH: number
  isActive: boolean
  availabilities: CourtAvailabilitySlot[]
}

export interface ClubPublic {
  id: string
  name: string
  description: string
  vibe: string
  city: string
  zone: string
  address: string
  lat: number
  lng: number
  phone: string
  email: string
  rating: number
  reviewCount: number
  amenities: string[]
  tags: string[]
  colorR: number
  colorG: number
  colorB: number
  photos: string[]
  isActive: boolean
  cancelHoursBeforeStart: number
}

export interface ClubWithCourts extends ClubPublic {
  courts: CourtWithAvailability[]
}

export interface BookingWithDetails {
  id: string
  userId: string
  clubId: string
  courtId: string
  date: Date
  startTime: string
  durationMinutes: number
  playerIds: string[]
  status: BookingStatus
  totalPrice: number // centavos ARS
  paymentStatus: PaymentStatus
  paymentId?: string | null
  isOpenMatch: boolean
  requiredLevel?: string | null
  spotsAvailable?: number | null
  source: BookingSource
  manualName?: string | null
  manualPhone?: string | null
  createdAt: Date
  updatedAt: Date
  user: UserPublic
  club: ClubPublic
  court: {
    id: string
    name: string
    type: CourtType
    covered: boolean
  }
}

/** A bookable time slot for a given court + date */
export interface TimeSlot {
  time: string // "19:00"
  endTime: string // "20:30" (for 90 min)
  pricePerHour: number // centavos
  available: boolean
  durationOptions: number[] // e.g. [60, 90, 120] — filtered by close time
  appliedRuleName?: string // nombre de la regla ganadora (para transparencia en wizard admin)
}

/** Standard return type for ALL Server Actions — never throw to the client */
export type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

// ── JWT SESSION PAYLOAD ───────────────────────────────────────────────────

export interface JwtSession {
  userId: string
  role: Role
  isBanned: boolean
  staffClubId?: string | null
  iat?: number
  exp?: number
}

// ── ANALYTICS ────────────────────────────────────────────────────────────

export interface ClubAnalytics {
  totalRevenue: number // centavos
  bookingRevenue: number // centavos
  barRevenue: number // centavos
  totalBookings: number
  cancelledBookings: number
  occupancyRate: number // 0–1
  peakHour: string // "19:00"
  topCourtId: string
  weeklyData: {
    day: string
    bookings: number
    revenue: number
  }[]
}

// ── BAR MODULE ────────────────────────────────────────────────────────────

export interface BarProductPublic {
  id: string
  clubId: string
  name: string
  category: BarCategory
  price: number // centavos
  stock: number
  minStock: number
  emoji: string
  active: boolean
}

export interface BarSaleWithItems {
  id: string
  clubId: string
  staffId?: string | null
  bookingId?: string | null
  total: number // centavos
  payMethod: PayMethod
  createdAt: Date
  items: {
    id: string
    productId: string
    productName: string
    qty: number
    unitPrice: number // centavos — price at moment of sale
  }[]
}
