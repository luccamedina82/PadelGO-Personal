import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ── Helpers ──────────────────────────────────────────────────────────────────

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function offsetDate(base: Date, days: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function wpick<T>(items: T[], weights: number[]): T {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!
    if (r <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

const MANUAL_NAMES = [
  'Rodrigo García', 'Valentina López', 'Marcos Herrera', 'Camila Ruiz',
  'Bruno Peralta', 'Lucía Fernández', 'Tomás Méndez', 'Sofía Castro',
  'Agustín Torres', 'Milagros Sosa', 'Felipe Romero', 'Antonella Reyes',
  'Ignacio Vega', 'Julieta Morales', 'Mateo Álvarez', 'Renata Giménez',
  'Facundo Ortiz', 'Catalina Blanco', 'Santiago Domínguez', 'Pilar Acosta',
  'Leandro Suárez', 'Florencia Cáceres', 'Diego Rojas', 'Ximena Palacios',
  'Sebastián Nieva', 'Paola Cabrera', 'Ezequiel Mena', 'Natalia Ibáñez',
]

const BLOCK_REASONS = [
  'Mantenimiento cancha', 'Reservado torneo', 'Clase grupal', 'Evento especial',
  'Reparación piso', 'Revisión iluminación', 'Torneo interno', 'Reserva privada',
  'Evento corporativo', 'Clase de academia',
]

// ── Booking filler ────────────────────────────────────────────────────────────

interface BookingRow {
  userId: string
  clubId: string
  courtId: string
  date: Date
  startTime: string
  durationMinutes: number
  playerIds: string[]
  paidPlayerIds: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status: any
  totalPrice: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paymentStatus: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: any
  manualName: string | null
  manualPhone: string | null
  isOpenMatch: boolean
}

function fillCourtDay(
  courtId: string,
  clubId: string,
  ownerUserId: string,
  players: { id: string }[],
  date: Date,
  openMin: number,
  closeMin: number,
  pricePerHour: number,
  fillRate: number,
  isPast: boolean,
): BookingRow[] {
  const rows: BookingRow[] = []
  let cur = openMin

  while (cur < closeMin - 59) {
    if (Math.random() > fillRate) {
      cur += 30
      continue
    }

    const remaining = closeMin - cur
    const possibleDurations = [60, 90, 120].filter((d) => d <= remaining)
    if (possibleDurations.length === 0) break

    const durationWeights = possibleDurations.map((d) =>
      d === 60 ? 0.38 : d === 90 ? 0.47 : 0.15
    )
    const duration = wpick(possibleDurations, durationWeights)

    const source = wpick(
      ['ONLINE', 'MANUAL_OWNER', 'ENTRENAMIENTO', 'TORNEO', 'BLOCK', 'MANTENIMIENTO', 'EVENTO'],
      [0.42,     0.33,           0.10,             0.06,    0.04,    0.03,             0.02]
    )

    const isBlock = source === 'BLOCK' || source === 'MANTENIMIENTO' || source === 'EVENTO'
    const player = isBlock ? { id: ownerUserId } : pick(players)
    const totalPrice = isBlock ? 0 : Math.round((pricePerHour / 60) * duration)

    let paymentStatus: string
    let status: string

    if (isPast) {
      if (isBlock) {
        paymentStatus = 'PAID'
        status = 'CONFIRMED'
      } else {
        paymentStatus = wpick(['PAID', 'UNPAID', 'REFUNDED'], [0.63, 0.32, 0.05])
        status = wpick(['CONFIRMED', 'CANCELLED', 'COMPLETED'], [0.65, 0.13, 0.22])
      }
    } else {
      paymentStatus = isBlock ? 'PAID' : wpick(['PAID', 'UNPAID'], [0.38, 0.62])
      status = isBlock ? 'CONFIRMED' : wpick(['CONFIRMED', 'PENDING'], [0.67, 0.33])
    }

    const manualName =
      source === 'MANUAL_OWNER'
        ? pick(MANUAL_NAMES)
        : source === 'BLOCK' || source === 'MANTENIMIENTO' || source === 'EVENTO'
          ? pick(BLOCK_REASONS)
          : null

    const manualPhone =
      source === 'MANUAL_OWNER'
        ? `351${String(Math.floor(4000000 + Math.random() * 5999999))}`
        : null

    rows.push({
      userId: player.id,
      clubId,
      courtId,
      date,
      startTime: minutesToTime(cur),
      durationMinutes: duration,
      playerIds: [],
      paidPlayerIds: [],
      status,
      totalPrice,
      paymentStatus,
      source,
      manualName,
      manualPhone,
      isOpenMatch: false,
    })

    cur += duration
  }

  return rows
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed masivo de PadelGo...\n')

  // ── CLEANUP ──────────────────────────────────────────────────────────────
  console.log('🧹 Limpiando base de datos...')
  await prisma.barSaleItem.deleteMany({})
  await prisma.barSale.deleteMany({})
  await prisma.barStockEntry.deleteMany({})
  await prisma.specialHours.deleteMany({})
  await prisma.booking.deleteMany({})
  await prisma.recurringBooking.deleteMany({})
  await prisma.review.deleteMany({})
  await prisma.invitation.deleteMany({})
  await prisma.court.deleteMany({})   // cascades CourtAvailability
  await prisma.club.deleteMany({})    // cascades BarProduct, etc.
  console.log('✅ BD limpia.\n')

  // ── USERS ────────────────────────────────────────────────────────────────
  console.log('👤 Creando usuarios...')

  await prisma.user.upsert({
    where: { email: 'lucas@padelgo.ar' },
    update: {},
    create: {
      name: 'Lucas Admin',
      email: 'lucas@padelgo.ar',
      password: await bcrypt.hash('admin1234', 12),
      zone: 'Córdoba',
      role: 'SUPERADMIN',
      avatarColor: '#d4f000',
      level: 5.0,
    },
  })

  const owner1 = await prisma.user.upsert({
    where: { email: 'diego@padelclub.ar' },
    update: {},
    create: {
      name: 'Diego Fernández',
      email: 'diego@padelclub.ar',
      password: await bcrypt.hash('owner1234', 12),
      zone: 'Nueva Córdoba',
      role: 'OWNER',
      avatarColor: '#ff6b35',
      level: 4.5,
    },
  })

  const owner2 = await prisma.user.upsert({
    where: { email: 'marina@racketclub.ar' },
    update: {},
    create: {
      name: 'Marina Costa',
      email: 'marina@racketclub.ar',
      password: await bcrypt.hash('owner1234', 12),
      zone: 'Güemes',
      role: 'OWNER',
      avatarColor: '#a855f7',
      level: 3.8,
    },
  })

  const owner3 = await prisma.user.upsert({
    where: { email: 'carlos@padelmax.ar' },
    update: {},
    create: {
      name: 'Carlos Mendez',
      email: 'carlos@padelmax.ar',
      password: await bcrypt.hash('owner1234', 12),
      zone: 'Cerro de las Rosas',
      role: 'OWNER',
      avatarColor: '#ef4444',
      level: 4.2,
    },
  })

  const owner4 = await prisma.user.upsert({
    where: { email: 'laura@clubpadel.ar' },
    update: {},
    create: {
      name: 'Laura González',
      email: 'laura@clubpadel.ar',
      password: await bcrypt.hash('owner1234', 12),
      zone: 'San Alonso',
      role: 'OWNER',
      avatarColor: '#3b82f6',
      level: 3.9,
    },
  })

  const staff2 = await prisma.user.upsert({
    where: { email: 'staff2@racketclub.ar' },
    update: {},
    create: {
      name: 'Andrea López',
      email: 'staff2@racketclub.ar',
      password: await bcrypt.hash('staff1234', 12),
      zone: 'Güemes',
      role: 'STAFF',
      avatarColor: '#8b5cf6',
      level: 3.1,
    },
  })

  // 22 jugadores como pool de usuarios para las reservas
  const playersData = [
    { email: 'matias@gmail.com',         name: 'Matías Rodríguez',   level: 4.2, matches: 47,  won: 28, streak: 5,  color: '#22c55e' },
    { email: 'vale@gmail.com',           name: 'Valentina López',    level: 3.5, matches: 23,  won: 11, streak: 2,  color: '#ec4899' },
    { email: 'seba@gmail.com',           name: 'Sebastián Gómez',    level: 5.8, matches: 112, won: 78, streak: 12, color: '#f59e0b' },
    { email: 'camila@gmail.com',         name: 'Camila Hertz',       level: 2.3, matches: 8,   won: 3,  streak: 0,  color: '#06b6d4' },
    { email: 'nico@gmail.com',           name: 'Nicolás Pereyra',    level: 6.1, matches: 89,  won: 61, streak: 7,  color: '#8b5cf6' },
    { email: 'lucas.torres@gmail.com',   name: 'Lucas Torres',       level: 4.0, matches: 56,  won: 32, streak: 3,  color: '#ef4444' },
    { email: 'martina.silva@gmail.com',  name: 'Martina Silva',      level: 3.8, matches: 34,  won: 19, streak: 4,  color: '#8b6f47' },
    { email: 'alberto.lopez@gmail.com',  name: 'Alberto López',      level: 5.2, matches: 78,  won: 52, streak: 6,  color: '#14b8a6' },
    { email: 'florencia@gmail.com',      name: 'Florencia Morales',  level: 3.2, matches: 19,  won: 8,  streak: 1,  color: '#f43f5e' },
    { email: 'gabriel.r@gmail.com',      name: 'Gabriel Rodríguez',  level: 4.5, matches: 63,  won: 40, streak: 8,  color: '#6366f1' },
    { email: 'victoria.ts@gmail.com',    name: 'Victoria Toscano',   level: 2.8, matches: 11,  won: 4,  streak: 0,  color: '#d946ef' },
    { email: 'javier.p@gmail.com',       name: 'Javier Pacheco',     level: 5.5, matches: 95,  won: 65, streak: 9,  color: '#0ea5e9' },
    { email: 'carolina.g@gmail.com',     name: 'Carolina García',    level: 3.9, matches: 41,  won: 22, streak: 3,  color: '#ec4899' },
    { email: 'ramon.m@gmail.com',        name: 'Ramón Méndez',       level: 4.7, matches: 72,  won: 48, streak: 5,  color: '#f59e0b' },
    { email: 'diana.c@gmail.com',        name: 'Diana Cortez',       level: 3.1, matches: 15,  won: 6,  streak: 0,  color: '#06b6d4' },
    { email: 'pedro.sanchez@gmail.com',  name: 'Pedro Sánchez',      level: 4.3, matches: 55,  won: 35, streak: 4,  color: '#22c55e' },
    { email: 'pablo.guzman@gmail.com',   name: 'Pablo Guzmán',       level: 5.9, matches: 118, won: 82, streak: 13, color: '#a78bfa' },
    { email: 'sandra.r@gmail.com',       name: 'Sandra Ramírez',     level: 2.9, matches: 12,  won: 5,  streak: 1,  color: '#fb7185' },
    { email: 'marcos.u@gmail.com',       name: 'Marcos Ulloa',       level: 4.4, matches: 59,  won: 38, streak: 6,  color: '#10b981' },
    { email: 'tatiana.v@gmail.com',      name: 'Tatiana Velázquez',  level: 3.6, matches: 29,  won: 15, streak: 2,  color: '#f97316' },
    { email: 'gustavo.r@gmail.com',      name: 'Gustavo Ruiz',       level: 5.1, matches: 84,  won: 56, streak: 7,  color: '#1d4ed8' },
    { email: 'monica.castillo@gmail.com',name: 'Mónica Castillo',    level: 3.3, matches: 21,  won: 10, streak: 1,  color: '#d97706' },
  ]

  const players: { id: string }[] = []
  for (const p of playersData) {
    const player = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        name: p.name,
        email: p.email,
        password: await bcrypt.hash('player1234', 12),
        zone: 'Córdoba',
        role: 'PLAYER',
        level: p.level,
        matchesPlayed: p.matches,
        matchesWon: p.won,
        streak: p.streak,
        avatarColor: p.color,
      },
    })
    players.push(player)
  }
  console.log(`✅ ${players.length + 6} usuarios listos.\n`)

  // ── ACHIEVEMENTS ──────────────────────────────────────────────────────────
  const achievements = [
    { key: 'first_booking',    icon: '🎾', name: 'Primera Reserva',   description: 'Reservaste tu primera cancha',       category: 'INICIO' as const,     total: 1 },
    { key: 'tenth_booking',    icon: '🏆', name: '10 Partidos',        description: 'Jugaste 10 partidos en PadelGo',     category: 'INICIO' as const,     total: 10 },
    { key: 'streak_7',         icon: '🔥', name: 'Racha de 7 días',    description: 'Jugaste 7 días consecutivos',        category: 'CONSTANCIA' as const, total: 7 },
    { key: 'streak_30',        icon: '⚡', name: 'Racha de 30 días',   description: 'Jugaste 30 días consecutivos',       category: 'CONSTANCIA' as const, total: 30 },
    { key: 'three_clubs',      icon: '🗺️', name: 'Explorador',         description: 'Reservaste en 3 clubes distintos',   category: 'EXPLORADOR' as const, total: 3 },
    { key: 'five_clubs',       icon: '🧭', name: 'Gran Explorador',    description: 'Reservaste en 5 clubes distintos',   category: 'EXPLORADOR' as const, total: 5 },
    { key: 'invite_friend',    icon: '👥', name: 'Compañero de Juego', description: 'Invitaste a un amigo a un partido',  category: 'SOCIAL' as const,     total: 1 },
    { key: 'open_match_host',  icon: '📣', name: 'Organizador',        description: 'Creaste tu primer Open Match',       category: 'SOCIAL' as const,     total: 1 },
    { key: 'level_5',          icon: '⭐', name: 'Nivel 5',            description: 'Alcanzaste el nivel 5.0',            category: 'NIVEL' as const,      total: 5 },
    { key: 'level_8',          icon: '💫', name: 'Nivel 8',            description: 'Alcanzaste el nivel 8.0',            category: 'NIVEL' as const,      total: 8 },
    { key: 'top10_zone',       icon: '🥇', name: 'Top 10 Zona',        description: 'Entraste al Top 10 de tu zona',      category: 'RANKING' as const,    total: 10 },
    { key: 'hundred_matches',  icon: '💯', name: '100 Partidos',        description: '¡100 partidos jugados!',            category: 'ESPECIAL' as const,   total: 100 },
  ]
  for (const a of achievements) {
    await prisma.achievement.upsert({ where: { key: a.key }, update: {}, create: a })
  }

  // ── TODAY (UTC midnight) ──────────────────────────────────────────────────
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)

  // ════════════════════════════════════════════════════════════════════════════
  // RACKET CLUB GÜEMES — 6 canchas, 60 días, fill rate alto
  // ════════════════════════════════════════════════════════════════════════════
  console.log('🏟️  Creando Racket Club Güemes (6 canchas)...')

  const racketClub = await prisma.club.create({
    data: {
      ownerId: owner2.id,
      name: 'Racket Club Güemes',
      description: 'El club más popular de Güemes. 6 canchas premium, bar, vestuarios y estacionamiento cubierto.',
      vibe: 'El corazón padelístico de Güemes',
      city: 'Córdoba',
      zone: 'Güemes',
      address: 'Av. Hipólito Yrigoyen 1420, Güemes, Córdoba',
      lat: -31.414,
      lng: -64.188,
      phone: '3514001234',
      email: 'info@racketguemes.ar',
      rating: 4.7,
      reviewCount: 214,
      amenities: ['Estacionamiento', 'Bar', 'Duchas', 'Vestuarios', 'WiFi', 'Iluminación LED', 'Pro shop'],
      tags: ['Techada', 'Premium', 'Torneos'],
      colorR: 168,
      colorG: 85,
      colorB: 247,
      cancelHoursBeforeStart: 2,
    },
  })

  // Staff asignado al club
  await prisma.user.update({
    where: { id: staff2.id },
    data: { staffClubId: racketClub.id },
  })

  // 6 canchas con precios distintos
  const racketCourtConfig = [
    { name: 'Cancha 1', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1200000 },
    { name: 'Cancha 2', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1200000 },
    { name: 'Cancha 3', type: 'MURO' as const,      covered: false, pricePerHour: 1000000 },
    { name: 'Cancha 4', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1400000 },
    { name: 'Cancha 5', type: 'PANORAMICA' as const, covered: false, pricePerHour: 900000  },
    { name: 'Cancha 6', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1300000 },
  ]

  const racketCourts: { id: string; pricePerHour: number }[] = []
  for (let i = 0; i < racketCourtConfig.length; i++) {
    const cfg = racketCourtConfig[i]!
    const court = await prisma.court.create({
      data: {
        clubId: racketClub.id,
        name: cfg.name,
        type: cfg.type,
        covered: cfg.covered,
        svgX: 50 + (i % 3) * 210,
        svgY: i < 3 ? 50 : 270,
        svgW: 160,
        svgH: 190,
      },
    })
    await prisma.bookingRule.create({
        data: {
          clubId: court.clubId, // Asegurate de que el objeto court tenga clubId (o usá la variable del club que tengas ahí)
          name: 'Regla Base Seed',
          priority: 0,
          courtIds: [court.id],
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: '08:00',
          endTime: '23:00',
          price: 1500000, // 15.000 ARS en centavos (Ajustalo al precio de tu seed)
          intervalMinutes: 30,
          allowedDurations: [60, 90, 120],
          isActive: true,
        }
      })
    racketCourts.push({ id: court.id, pricePerHour: cfg.pricePerHour })
  }

  // Generar reservas: 30 días pasados + hoy + 29 días futuros = 60 días
  console.log('📅 Generando reservas Racket Club Güemes (60 días × 6 canchas)...')
  let racketTotal = 0

  for (let dayOffset = -30; dayOffset <= 29; dayOffset++) {
    const date = offsetDate(todayUTC, dayOffset)
    const isPast = dayOffset < 0
    const dow = date.getUTCDay()
    // Fines de semana más llenos (viernes incluido)
    const isWeekend = dow === 0 || dow === 5 || dow === 6
    const fillRate = isWeekend ? 0.90 : 0.74

    const dayRows: BookingRow[] = []
    for (const court of racketCourts) {
      const rows = fillCourtDay(
        court.id, racketClub.id, owner2.id, players,
        date, 8 * 60, 23 * 60, court.pricePerHour, fillRate, isPast
      )
      dayRows.push(...rows)
    }
    if (dayRows.length > 0) {
      await prisma.booking.createMany({ data: dayRows })
      racketTotal += dayRows.length
    }
  }
  console.log(`✅ Racket Club Güemes: ${racketTotal} reservas.\n`)

  // ════════════════════════════════════════════════════════════════════════════
  // CLUBES SECUNDARIOS
  // ════════════════════════════════════════════════════════════════════════════

  const secondaryClubs = [
    {
      owner: owner1,
      name: 'PadelClub Nueva Córdoba',
      description: 'El club más moderno de Nueva Córdoba con canchas profesionales y ambiente único',
      vibe: 'El favorito de Nueva Córdoba',
      zone: 'Nueva Córdoba',
      address: 'Av. Hipólito Yrigoyen 3550, Nueva Córdoba',
      lat: -31.420, lng: -64.195,
      phone: '3514112233', email: 'info@padelclub.ar',
      colorR: 255, colorG: 107, colorB: 53,
      courts: [
        { name: 'Cancha A', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1100000 },
        { name: 'Cancha B', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1100000 },
        { name: 'Cancha C', type: 'MURO' as const,      covered: false, pricePerHour: 900000  },
        { name: 'Cancha D', type: 'PANORAMICA' as const, covered: false, pricePerHour: 850000  },
      ],
      days: 30, fillRate: 0.62,
    },
    {
      owner: owner3,
      name: 'PadelMax Cerro',
      description: 'Las mejores canchas de Cerro de las Rosas en un ambiente premium',
      vibe: 'Nivel premium en el Cerro',
      zone: 'Cerro de las Rosas',
      address: 'Rafael Núñez 4321, Cerro de las Rosas',
      lat: -31.370, lng: -64.220,
      phone: '3514223344', email: 'info@padelmax.ar',
      colorR: 239, colorG: 68, colorB: 68,
      courts: [
        { name: 'Cancha 1', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1500000 },
        { name: 'Cancha 2', type: 'CRISTAL' as const,   covered: true,  pricePerHour: 1500000 },
        { name: 'Cancha 3', type: 'PANORAMICA' as const, covered: false, pricePerHour: 1200000 },
      ],
      days: 30, fillRate: 0.57,
    },
    {
      owner: owner4,
      name: 'Club Pádel San Alonso',
      description: 'El clásico de San Alonso. Ambiente familiar, precios accesibles y buena onda.',
      vibe: 'Familia y pádel',
      zone: 'San Alonso',
      address: 'Av. San Martín 2200, San Alonso',
      lat: -31.395, lng: -64.170,
      phone: '3514334455', email: 'info@clubpadel.ar',
      colorR: 59, colorG: 130, colorB: 246,
      courts: [
        { name: 'Cancha 1', type: 'MURO' as const,    covered: true,  pricePerHour: 900000 },
        { name: 'Cancha 2', type: 'MURO' as const,    covered: true,  pricePerHour: 900000 },
        { name: 'Cancha 3', type: 'CRISTAL' as const, covered: false, pricePerHour: 800000 },
      ],
      days: 30, fillRate: 0.52,
    },
  ]

  for (const cfg of secondaryClubs) {
    console.log(`🏟️  Creando ${cfg.name}...`)
    const club = await prisma.club.create({
      data: {
        ownerId: cfg.owner.id,
        name: cfg.name,
        description: cfg.description,
        vibe: cfg.vibe,
        city: 'Córdoba',
        zone: cfg.zone,
        address: cfg.address,
        lat: cfg.lat,
        lng: cfg.lng,
        phone: cfg.phone,
        email: cfg.email,
        rating: parseFloat((3.8 + Math.random() * 0.9).toFixed(1)),
        reviewCount: Math.floor(20 + Math.random() * 80),
        amenities: ['Estacionamiento', 'Vestuarios', 'Duchas'],
        tags: ['Techada'],
        colorR: cfg.colorR,
        colorG: cfg.colorG,
        colorB: cfg.colorB,
      },
    })

    const courts: { id: string; pricePerHour: number }[] = []
    for (let i = 0; i < cfg.courts.length; i++) {
      const c = cfg.courts[i]!
      const court = await prisma.court.create({
        data: {
          clubId: club.id,
          name: c.name,
          type: c.type,
          covered: c.covered,
          svgX: 50 + i * 200,
          svgY: 50,
          svgW: 160,
          svgH: 190,
        },
      })
      await prisma.bookingRule.create({
        data: {
          clubId: court.clubId, // O pasale la variable de ID de club que tengas a mano ahí
          name: 'Tarifa Base',
          priority: 0,
          courtIds: [court.id],
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: '08:00',
          endTime: '23:00',
          price: c.pricePerHour, // 🟢 Mantenemos el precio que venía en tu variable 'c'
          intervalMinutes: 30,
          allowedDurations: [60, 90, 120],
          isActive: true,
        }
      })
      courts.push({ id: court.id, pricePerHour: c.pricePerHour })
    }

    let clubTotal = 0
    for (let dayOffset = -15; dayOffset < cfg.days - 15; dayOffset++) {
      const date = offsetDate(todayUTC, dayOffset)
      const isPast = dayOffset < 0
      const dow = date.getUTCDay()
      const isWeekend = dow === 0 || dow === 5 || dow === 6
      const fillRate = isWeekend ? cfg.fillRate + 0.14 : cfg.fillRate

      const dayRows: BookingRow[] = []
      for (const court of courts) {
        const rows = fillCourtDay(
          court.id, club.id, cfg.owner.id, players,
          date, 8 * 60, 23 * 60, court.pricePerHour, fillRate, isPast
        )
        dayRows.push(...rows)
      }
      if (dayRows.length > 0) {
        await prisma.booking.createMany({ data: dayRows })
        clubTotal += dayRows.length
      }
    }
    console.log(`✅ ${cfg.name}: ${clubTotal} reservas.\n`)
  }

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  const totalBookings = await prisma.booking.count()
  console.log('════════════════════════════════════════')
  console.log(`🎉 Seed completado. Total reservas: ${totalBookings}`)
  console.log('════════════════════════════════════════')
  console.log('\n📋 Credenciales:')
  console.log('  marina@racketclub.ar  / owner1234   → Racket Club Güemes (6 canchas)')
  console.log('  diego@padelclub.ar    / owner1234   → PadelClub Nueva Córdoba')
  console.log('  carlos@padelmax.ar    / owner1234   → PadelMax Cerro')
  console.log('  laura@clubpadel.ar    / owner1234   → Club Pádel San Alonso')
  console.log('  staff2@racketclub.ar  / staff1234   → Staff Racket Club Güemes')
  console.log('  lucas@padelgo.ar      / admin1234   → Superadmin\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
