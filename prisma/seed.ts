import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Helper: agregar días a una fecha
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function main() {
  console.log('Iniciando seed de PadelGo...\n')

  // ─────────────────────────────────────────────
  // CLEANUP: Clear all tables (reverse dependency order)
  // ─────────────────────────────────────────────
  console.log('Limpiando datos previos...')

  await prisma.barSale.deleteMany({})
  await prisma.barStockEntry.deleteMany({})
  await prisma.specialHours.deleteMany({})
  await prisma.booking.deleteMany({})
  await prisma.court.deleteMany({})
  await prisma.club.deleteMany({})

  console.log('BD limpia. Iniciando seed.\n')

  // ─────────────────────────────────────────────
  // USERS: SUPERADMIN + OWNERs (5 total)
  // ─────────────────────────────────────────────

  const superadmin = await prisma.user.upsert({
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

  const owner5 = await prisma.user.upsert({
    where: { email: 'francisco@clubdepadel.ar' },
    update: {},
    create: {
      name: 'Francisco Ruiz',
      email: 'francisco@clubdepadel.ar',
      password: await bcrypt.hash('owner1234', 12),
      zone: 'Alto de la Paz',
      role: 'OWNER',
      avatarColor: '#10b981',
      level: 4.0,
    },
  })

  const owners = [owner1, owner2, owner3, owner4, owner5]

  // ─────────────────────────────────────────────
  // STAFF (1 por cada club)
  // ─────────────────────────────────────────────

  const staff1 = await prisma.user.upsert({
    where: { email: 'staff1@padelclub.ar' },
    update: {},
    create: {
      name: 'Juan Martínez',
      email: 'staff1@padelclub.ar',
      password: await bcrypt.hash('staff1234', 12),
      zone: 'Nueva Córdoba',
      role: 'STAFF',
      avatarColor: '#f59e0b',
      level: 2.8,
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

  const staff3 = await prisma.user.upsert({
    where: { email: 'staff3@padelmax.ar' },
    update: {},
    create: {
      name: 'Roberto Silva',
      email: 'staff3@padelmax.ar',
      password: await bcrypt.hash('staff1234', 12),
      zone: 'Cerro de las Rosas',
      role: 'STAFF',
      avatarColor: '#06b6d4',
      level: 2.5,
    },
  })

  const staff4 = await prisma.user.upsert({
    where: { email: 'staff4@clubpadel.ar' },
    update: {},
    create: {
      name: 'Sofía Torres',
      email: 'staff4@clubpadel.ar',
      password: await bcrypt.hash('staff1234', 12),
      zone: 'San Alonso',
      role: 'STAFF',
      avatarColor: '#ec4899',
      level: 2.9,
    },
  })

  const staff5 = await prisma.user.upsert({
    where: { email: 'staff5@clubdepadel.ar' },
    update: {},
    create: {
      name: 'Miguel Reyes',
      email: 'staff5@clubdepadel.ar',
      password: await bcrypt.hash('staff1234', 12),
      zone: 'Alto de la Paz',
      role: 'STAFF',
      avatarColor: '#84cc16',
      level: 3.0,
    },
  })

  const staffList = [staff1, staff2, staff3, staff4, staff5]

  // ─────────────────────────────────────────────
  // PLAYERs (20+ jugadores realistas)
  // ─────────────────────────────────────────────

  const playersData = [
    {
      email: 'matias@gmail.com',
      name: 'Matías Rodríguez',
      level: 4.2,
      matches: 47,
      won: 28,
      streak: 5,
      color: '#22c55e',
    },
    {
      email: 'vale@gmail.com',
      name: 'Valentina López',
      level: 3.5,
      matches: 23,
      won: 11,
      streak: 2,
      color: '#ec4899',
    },
    {
      email: 'seba@gmail.com',
      name: 'Sebastián Gómez',
      level: 5.8,
      matches: 112,
      won: 78,
      streak: 12,
      color: '#f59e0b',
    },
    {
      email: 'camila@gmail.com',
      name: 'Camila Hertz',
      level: 2.3,
      matches: 8,
      won: 3,
      streak: 0,
      color: '#06b6d4',
    },
    {
      email: 'nico@gmail.com',
      name: 'Nicolás Pereyra',
      level: 6.1,
      matches: 89,
      won: 61,
      streak: 7,
      color: '#8b5cf6',
    },
    {
      email: 'lucas.torres@gmail.com',
      name: 'Lucas Torres',
      level: 4.0,
      matches: 56,
      won: 32,
      streak: 3,
      color: '#ef4444',
    },
    {
      email: 'martina.silva@gmail.com',
      name: 'Martina Silva',
      level: 3.8,
      matches: 34,
      won: 19,
      streak: 4,
      color: '#8b6f47',
    },
    {
      email: 'alberto.lopez@gmail.com',
      name: 'Alberto López',
      level: 5.2,
      matches: 78,
      won: 52,
      streak: 6,
      color: '#14b8a6',
    },
    {
      email: 'florencia@gmail.com',
      name: 'Florencia Morales',
      level: 3.2,
      matches: 19,
      won: 8,
      streak: 1,
      color: '#f43f5e',
    },
    {
      email: 'gabriel.r@gmail.com',
      name: 'Gabriel Rodríguez',
      level: 4.5,
      matches: 63,
      won: 40,
      streak: 8,
      color: '#6366f1',
    },
    {
      email: 'victoria.ts@gmail.com',
      name: 'Victoria Toscano',
      level: 2.8,
      matches: 11,
      won: 4,
      streak: 0,
      color: '#d946ef',
    },
    {
      email: 'javier.p@gmail.com',
      name: 'Javier Pacheco',
      level: 5.5,
      matches: 95,
      won: 65,
      streak: 9,
      color: '#0ea5e9',
    },
    {
      email: 'carolina.g@gmail.com',
      name: 'Carolina García',
      level: 3.9,
      matches: 41,
      won: 22,
      streak: 3,
      color: '#ec4899',
    },
    {
      email: 'ramon.m@gmail.com',
      name: 'Ramón Méndez',
      level: 4.7,
      matches: 72,
      won: 48,
      streak: 5,
      color: '#f59e0b',
    },
    {
      email: 'diana.c@gmail.com',
      name: 'Diana Cortez',
      level: 3.1,
      matches: 15,
      won: 6,
      streak: 0,
      color: '#06b6d4',
    },
    {
      email: 'pedro.sanchez@gmail.com',
      name: 'Pedro Sánchez',
      level: 4.3,
      matches: 55,
      won: 35,
      streak: 4,
      color: '#22c55e',
    },
    {
      email: 'pablo.guzman@gmail.com',
      name: 'Pablo Guzmán',
      level: 5.9,
      matches: 118,
      won: 82,
      streak: 13,
      color: '#a78bfa',
    },
    {
      email: 'sandra.r@gmail.com',
      name: 'Sandra Ramírez',
      level: 2.9,
      matches: 12,
      won: 5,
      streak: 1,
      color: '#fb7185',
    },
    {
      email: 'marcos.u@gmail.com',
      name: 'Marcos Ulloa',
      level: 4.4,
      matches: 59,
      won: 38,
      streak: 6,
      color: '#10b981',
    },
    {
      email: 'tatiana.v@gmail.com',
      name: 'Tatiana Velázquez',
      level: 3.6,
      matches: 29,
      won: 15,
      streak: 2,
      color: '#f97316',
    },
    {
      email: 'gustavo.r@gmail.com',
      name: 'Gustavo Ruiz',
      level: 5.1,
      matches: 84,
      won: 56,
      streak: 7,
      color: '#1d4ed8',
    },
    {
      email: 'monica.castillo@gmail.com',
      name: 'Mónica Castillo',
      level: 3.3,
      matches: 21,
      won: 10,
      streak: 1,
      color: '#d97706',
    },
  ]

  const players = []
  for (const p of playersData) {
    const player = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        name: p.name,
        email: p.email,
        password: await bcrypt.hash('player1234', 12),
        zone: 'Nueva Córdoba',
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

  // ─────────────────────────────────────────────
  // ACHIEVEMENTS
  // ─────────────────────────────────────────────

  const achievementData = [
    {
      key: 'first_booking',
      icon: '🎾',
      name: 'Primera Reserva',
      description: 'Reservaste tu primera cancha',
      category: 'INICIO' as const,
      total: 1,
    },
    {
      key: 'tenth_booking',
      icon: '🏆',
      name: '10 Partidos',
      description: 'Jugaste 10 partidos en PadelGo',
      category: 'INICIO' as const,
      total: 10,
    },
    {
      key: 'streak_7',
      icon: '🔥',
      name: 'Racha de 7 días',
      description: 'Jugaste 7 días consecutivos',
      category: 'CONSTANCIA' as const,
      total: 7,
    },
    {
      key: 'streak_30',
      icon: '⚡',
      name: 'Racha de 30 días',
      description: 'Jugaste 30 días consecutivos',
      category: 'CONSTANCIA' as const,
      total: 30,
    },
    {
      key: 'three_clubs',
      icon: '🗺️',
      name: 'Explorador',
      description: 'Reservaste en 3 clubes distintos',
      category: 'EXPLORADOR' as const,
      total: 3,
    },
    {
      key: 'five_clubs',
      icon: '🧭',
      name: 'Gran Explorador',
      description: 'Reservaste en 5 clubes distintos',
      category: 'EXPLORADOR' as const,
      total: 5,
    },
    {
      key: 'invite_friend',
      icon: '👥',
      name: 'Compañero de Juego',
      description: 'Invitaste a un amigo a un partido',
      category: 'SOCIAL' as const,
      total: 1,
    },
    {
      key: 'open_match_host',
      icon: '📣',
      name: 'Organizador',
      description: 'Creaste tu primer Open Match',
      category: 'SOCIAL' as const,
      total: 1,
    },
    {
      key: 'level_5',
      icon: '⭐',
      name: 'Nivel 5',
      description: 'Alcanzaste el nivel 5.0',
      category: 'NIVEL' as const,
      total: 5,
    },
    {
      key: 'level_8',
      icon: '💫',
      name: 'Nivel 8',
      description: 'Alcanzaste el nivel 8.0',
      category: 'NIVEL' as const,
      total: 8,
    },
    {
      key: 'top10_zone',
      icon: '🥇',
      name: 'Top 10 Zona',
      description: 'Entraste al Top 10 de tu zona',
      category: 'RANKING' as const,
      total: 10,
    },
    {
      key: 'hundred_matches',
      icon: '💯',
      name: '100 Partidos',
      description: '¡100 partidos jugados!',
      category: 'ESPECIAL' as const,
      total: 100,
    },
  ]

  for (const achievement of achievementData) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {},
      create: achievement,
    })
  }

  // ─────────────────────────────────────────────
  // CLUBs (5 clubes, uno por cada owner)
  // ─────────────────────────────────────────────

  const clubsData = [
    {
      ownerId: owner1.id,
      name: 'PadelClub Nueva Córdoba',
      description:
        'El club más moderno de Nueva Córdoba con canchas profesionales y ambiente único',
      vibe: 'El favorito de Nueva Córdoba',
      city: 'Córdoba',
      zone: 'Nueva Córdoba',
      address: 'Av. Hipólito Yrigoyen 610, Nueva Córdoba',
      lat: -31.42,
      lng: -64.183,
      phone: '+54 351 480-1234',
      email: 'info@padelclub.ar',
      rating: 4.8,
      reviewCount: 127,
      amenities: ['Estacionamiento', 'Vestuarios', 'Bar', 'WiFi', 'Duchas'],
      tags: ['Techada', 'Premium', 'Iluminada'],
      colorR: 212,
      colorG: 240,
      colorB: 0,
      cancelHoursBeforeStart: 2,
      cancellationFeePercent: 15,
      allowedDurations: [60, 90, 120],
    },
    {
      ownerId: owner2.id,
      name: 'Racket Club Güemes',
      description: 'Club familiar en Güemes con 4 canchas y excelente servicio de bar',
      vibe: 'El clásico de Güemes',
      city: 'Córdoba',
      zone: 'Güemes',
      address: 'Av. Olmos 360, Güemes',
      lat: -31.437,
      lng: -64.194,
      phone: '+54 351 488-5678',
      email: 'info@racketclub.ar',
      rating: 4.5,
      reviewCount: 89,
      amenities: ['Estacionamiento', 'Vestuarios', 'Bar', 'Tienda', 'Duchas'],
      tags: ['Exterior', 'Familiar', 'Iluminada'],
      colorR: 168,
      colorG: 85,
      colorB: 247,
      cancelHoursBeforeStart: 3,
      cancellationFeePercent: 20,
      allowedDurations: [90, 120],
    },
    {
      ownerId: owner3.id,
      name: 'Padel Max Cerro',
      description: 'Instalaciones de lujo en Cerro de las Rosas, Tier 1 de la ciudad',
      vibe: 'Lujo y deporte',
      city: 'Córdoba',
      zone: 'Cerro de las Rosas',
      address: 'Alsino 1500, Cerro de las Rosas',
      lat: -31.44,
      lng: -64.19,
      phone: '+54 351 492-3456',
      email: 'info@padelmax.ar',
      rating: 4.9,
      reviewCount: 156,
      amenities: [
        'Estacionamiento Premium',
        'Vestuarios VIP',
        'Bar Gourmet',
        'WiFi 5G',
        'Sauna',
        'Piscina',
      ],
      tags: ['Techada', 'Premium', 'VIP'],
      colorR: 220,
      colorG: 38,
      colorB: 38,
      cancelHoursBeforeStart: 2,
      cancellationFeePercent: 25,
      allowedDurations: [60, 90, 120],
    },
    {
      ownerId: owner4.id,
      name: 'Club de Padel San Alonso',
      description: 'Club deportivo integral con ambiente de barrio',
      vibe: 'Comunidad y diversión',
      city: 'Córdoba',
      zone: 'San Alonso',
      address: 'Calle Sarmiento 1234, San Alonso',
      lat: -31.41,
      lng: -64.2,
      phone: '+54 351 484-7890',
      email: 'info@clubpadel.ar',
      rating: 4.3,
      reviewCount: 72,
      amenities: ['Estacionamiento', 'Vestuarios', 'Bar', 'Kiosko', 'Duchas'],
      tags: ['Exterior', 'Familiar', 'Económico'],
      colorR: 59,
      colorG: 130,
      colorB: 246,
      cancelHoursBeforeStart: 3,
      cancellationFeePercent: 10,
      allowedDurations: [80, 90, 120],
    },
    {
      ownerId: owner5.id,
      name: 'Club Deportivo El Padel',
      description: 'Espacio moderno y accesible para todos los niveles',
      vibe: 'Inclusión y deporte',
      city: 'Córdoba',
      zone: 'Alto de la Paz',
      address: 'Av. Pueyrredón 2500, Alto de la Paz',
      lat: -31.39,
      lng: -64.21,
      phone: '+54 351 486-1111',
      email: 'info@clubdepadel.ar',
      rating: 4.6,
      reviewCount: 98,
      amenities: ['Estacionamiento', 'Vestuarios', 'Bar', 'WiFi', 'Duchas'],
      tags: ['Techada', 'Familiar', 'Iluminada'],
      colorR: 16,
      colorG: 185,
      colorB: 129,
      cancelHoursBeforeStart: 2,
      cancellationFeePercent: 12,
      allowedDurations: [60, 90, 120],
    },
  ]

  const clubs = []
  for (const clubData of clubsData) {
    const existing = await prisma.club.findFirst({
      where: { ownerId: clubData.ownerId, name: clubData.name },
    })

    const club = existing
      ? await prisma.club.update({
          where: { id: existing.id },
          data: { ...clubData, photos: [] },
        })
      : await prisma.club.create({
          data: { ...clubData, photos: [] },
        })
    clubs.push(club)
  }

  // Assign staff to clubs
  for (let i = 0; i < staffList.length; i++) {
    await prisma.user.update({
      where: { id: staffList[i].id },
      data: { staffClubId: clubs[i].id },
    })
  }

  const club1 = clubs[0]
  const club2 = clubs[1]

  // ─────────────────────────────────────────────
  // COURTs — recreate for each club
  // ─────────────────────────────────────────────

  // Helper to build 7-day availability for a court
  function buildAvailability() {
    const entries: {
      dayOfWeek: number
      openTime: string
      closeTime: string
      pricePerHour: number
      isActive: boolean
    }[] = []

    for (let day = 0; day <= 6; day++) {
      const isWeekend = day === 0 || day === 6
      entries.push({
        dayOfWeek: day,
        openTime: isWeekend ? '09:00' : '08:00',
        closeTime: isWeekend ? '22:00' : '23:00',
        pricePerHour: isWeekend ? 750000 : 600000,
        isActive: true,
      })
    }

    return entries
  }

  // Create courts for all clubs
  const courtsPerClub = [
    // Club 1: 3 courts
    [
      {
        name: 'Cancha 1',
        type: 'CRISTAL' as const,
        covered: true,
        svgX: 10,
        svgY: 10,
        svgW: 80,
        svgH: 160,
      },
      {
        name: 'Cancha 2',
        type: 'PANORAMICA' as const,
        covered: false,
        svgX: 110,
        svgY: 10,
        svgW: 80,
        svgH: 160,
      },
      {
        name: 'Cancha 3',
        type: 'MURO' as const,
        covered: true,
        svgX: 210,
        svgY: 10,
        svgW: 80,
        svgH: 160,
      },
    ],
    // Club 2: 4 courts
    [
      {
        name: 'Cancha A',
        type: 'CRISTAL' as const,
        covered: false,
        svgX: 10,
        svgY: 10,
        svgW: 120,
        svgH: 160,
      },
      {
        name: 'Cancha B',
        type: 'CRISTAL' as const,
        covered: false,
        svgX: 150,
        svgY: 10,
        svgW: 120,
        svgH: 160,
      },
      {
        name: 'Cancha C',
        type: 'MURO' as const,
        covered: true,
        svgX: 290,
        svgY: 10,
        svgW: 120,
        svgH: 160,
      },
      {
        name: 'Cancha D',
        type: 'PANORAMICA' as const,
        covered: false,
        svgX: 10,
        svgY: 180,
        svgW: 120,
        svgH: 160,
      },
    ],
    // Club 3: 5 courts
    [
      {
        name: 'Cancha Premium 1',
        type: 'CRISTAL' as const,
        covered: true,
        svgX: 10,
        svgY: 10,
        svgW: 100,
        svgH: 150,
      },
      {
        name: 'Cancha Premium 2',
        type: 'CRISTAL' as const,
        covered: true,
        svgX: 120,
        svgY: 10,
        svgW: 100,
        svgH: 150,
      },
      {
        name: 'Cancha VIP',
        type: 'PANORAMICA' as const,
        covered: true,
        svgX: 230,
        svgY: 10,
        svgW: 100,
        svgH: 150,
      },
      {
        name: 'Cancha 4',
        type: 'MURO' as const,
        covered: true,
        svgX: 10,
        svgY: 170,
        svgW: 100,
        svgH: 150,
      },
      {
        name: 'Cancha 5',
        type: 'CRISTAL' as const,
        covered: false,
        svgX: 120,
        svgY: 170,
        svgW: 100,
        svgH: 150,
      },
    ],
    // Club 4: 3 courts
    [
      {
        name: 'Cancha 1',
        type: 'CRISTAL' as const,
        covered: true,
        svgX: 10,
        svgY: 10,
        svgW: 90,
        svgH: 160,
      },
      {
        name: 'Cancha 2',
        type: 'MURO' as const,
        covered: true,
        svgX: 110,
        svgY: 10,
        svgW: 90,
        svgH: 160,
      },
      {
        name: 'Cancha 3',
        type: 'CRISTAL' as const,
        covered: false,
        svgX: 210,
        svgY: 10,
        svgW: 90,
        svgH: 160,
      },
    ],
    // Club 5: 4 courts
    [
      {
        name: 'Cancha A',
        type: 'CRISTAL' as const,
        covered: true,
        svgX: 10,
        svgY: 10,
        svgW: 110,
        svgH: 160,
      },
      {
        name: 'Cancha B',
        type: 'CRISTAL' as const,
        covered: true,
        svgX: 130,
        svgY: 10,
        svgW: 110,
        svgH: 160,
      },
      {
        name: 'Cancha C',
        type: 'PANORAMICA' as const,
        covered: false,
        svgX: 250,
        svgY: 10,
        svgW: 110,
        svgH: 160,
      },
      {
        name: 'Cancha D',
        type: 'MURO' as const,
        covered: true,
        svgX: 10,
        svgY: 180,
        svgW: 110,
        svgH: 160,
      },
    ],
  ]

  const allCourts: any[] = []
  for (let i = 0; i < clubs.length; i++) {
    for (const courtData of courtsPerClub[i]) {
      const court = await prisma.court.create({
        data: {
          clubId: clubs[i].id,
          name: courtData.name,
          type: courtData.type,
          covered: courtData.covered,
          svgX: courtData.svgX,
          svgY: courtData.svgY,
          svgW: courtData.svgW,
          svgH: courtData.svgH,
          isActive: true,
          availabilities: {
            create: buildAvailability(),
          },
        },
      })
      allCourts.push(court)
    }
  }

  // ─────────────────────────────────────────────
  // BAR PRODUCTS — deleteMany by clubId, then recreate
  // ─────────────────────────────────────────────

  for (const club of clubs) {
    await prisma.barProduct.deleteMany({ where: { clubId: club.id } })
  }

  // Standard bar products catalog
  const baseProducts: {
    name: string
    category: 'BEBIDAS' | 'COMIDAS' | 'SNACKS' | 'DEPORTIVO'
    price: number
    stock: number
    minStock: number
    emoji: string
  }[] = [
    // BEBIDAS
    { name: 'Agua 500ml', category: 'BEBIDAS', price: 60000, stock: 50, minStock: 10, emoji: '💧' },
    { name: 'Coca Cola', category: 'BEBIDAS', price: 85000, stock: 35, minStock: 8, emoji: '🥤' },
    { name: 'Gatorade', category: 'BEBIDAS', price: 95000, stock: 28, minStock: 6, emoji: '⚡' },
    { name: 'Cerveza', category: 'BEBIDAS', price: 120000, stock: 50, minStock: 12, emoji: '🍺' },
    { name: 'Café', category: 'BEBIDAS', price: 50000, stock: 40, minStock: 10, emoji: '☕' },
    // COMIDAS
    {
      name: 'Sándwich de Jamón',
      category: 'COMIDAS',
      price: 180000,
      stock: 10,
      minStock: 3,
      emoji: '🥪',
    },
    {
      name: 'Medialunas x3',
      category: 'COMIDAS',
      price: 120000,
      stock: 15,
      minStock: 4,
      emoji: '🥐',
    },
    {
      name: 'Empanadas x2',
      category: 'COMIDAS',
      price: 160000,
      stock: 12,
      minStock: 3,
      emoji: '🥟',
    },
    // SNACKS
    { name: 'Papas Fritas', category: 'SNACKS', price: 80000, stock: 25, minStock: 5, emoji: '🍟' },
    { name: 'Maní', category: 'SNACKS', price: 60000, stock: 35, minStock: 8, emoji: '🥜' },
    {
      name: 'Barrita de Cereal',
      category: 'SNACKS',
      price: 70000,
      stock: 20,
      minStock: 5,
      emoji: '🍫',
    },
    // DEPORTIVO
    { name: 'Grip', category: 'DEPORTIVO', price: 220000, stock: 12, minStock: 2, emoji: '🎾' },
    {
      name: 'Pelotas x3',
      category: 'DEPORTIVO',
      price: 350000,
      stock: 15,
      minStock: 3,
      emoji: '🟡',
    },
    { name: 'Toalla', category: 'DEPORTIVO', price: 180000, stock: 8, minStock: 2, emoji: '🏖️' },
  ]

  // Create bar products for all clubs
  for (const club of clubs) {
    await prisma.barProduct.createMany({
      data: baseProducts.map((p) => ({
        ...p,
        clubId: club.id,
        active: true,
      })),
    })
  }

  // ─────────────────────────────────────────────
  // BOOKINGS (actividad realista: 7 días atrás + próximos 14 días)
  // ─────────────────────────────────────────────

  const today = new Date()
  let bookingCount = 0

  for (let dayOffset = -7; dayOffset <= 14; dayOffset++) {
    const bookingDate = addDays(today, dayOffset)

    // 2-4 bookings por día
    const numBookings = Math.floor(Math.random() * 3) + 2

    for (let i = 0; i < numBookings; i++) {
      const clubIdx = Math.floor(Math.random() * clubs.length)
      const club = clubs[clubIdx]
      const club_courts = allCourts.filter((c) => c.clubId === club.id)
      const court = club_courts[Math.floor(Math.random() * club_courts.length)]
      const player = players[Math.floor(Math.random() * players.length)]

      const startTime = [
        '08:00',
        '09:00',
        '10:00',
        '16:00',
        '17:00',
        '18:00',
        '19:00',
        '20:00',
        '21:00',
      ][Math.floor(Math.random() * 9)]

      const durationMinutes = [60, 90, 120][Math.floor(Math.random() * 3)]
      const price = durationMinutes === 60 ? 600000 : durationMinutes === 90 ? 900000 : 1200000

      const booking = await prisma.booking.create({
        data: {
          userId: player.id,
          clubId: club.id,
          courtId: court.id,
          date: bookingDate,
          startTime,
          durationMinutes,
          playerIds: [player.id],
          paidPlayerIds: [player.id],
          totalPrice: price,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          source: 'ONLINE',
        },
      })
      bookingCount++
    }
  }

  // ─────────────────────────────────────────────
  // BAR SALES (actividad en los últimos 30 días)
  // ─────────────────────────────────────────────

  let saleCount = 0

  for (let dayOffset = -30; dayOffset < 0; dayOffset++) {
    const saleDate = addDays(today, dayOffset)

    // 2-5 sales por día
    const numSales = Math.floor(Math.random() * 4) + 2

    for (let i = 0; i < numSales; i++) {
      const clubIdx = Math.floor(Math.random() * clubs.length)
      const club = clubs[clubIdx]
      const staff = staffList[clubIdx]

      const clubProducts = await prisma.barProduct.findMany({
        where: { clubId: club.id, active: true },
      })

      // 1-4 items por sale
      const numItems = Math.floor(Math.random() * 4) + 1
      const items = []
      let saleTotal = 0

      for (let j = 0; j < numItems; j++) {
        const product = clubProducts[Math.floor(Math.random() * clubProducts.length)]
        const qty = Math.floor(Math.random() * 3) + 1
        const itemPrice = product.price * qty
        saleTotal += itemPrice

        items.push({
          productId: product.id,
          qty,
          unitPrice: product.price,
        })
      }

      const payMethods: Array<'EFECTIVO' | 'TRANSFERENCIA' | 'POSNET'> = [
        'EFECTIVO',
        'TRANSFERENCIA',
        'POSNET',
      ]

      await prisma.barSale.create({
        data: {
          clubId: club.id,
          staffId: staff.id,
          total: saleTotal,
          payMethod: payMethods[Math.floor(Math.random() * 3)],
          createdAt: saleDate,
          items: {
            create: items,
          },
        },
      })
      saleCount++
    }
  }

  // ─────────────────────────────────────────────
  // BAR STOCK ENTRIES (registros de entrada)
  // ─────────────────────────────────────────────

  let entriesCount = 0

  for (let dayOffset = -30; dayOffset < 0; dayOffset += Math.floor(Math.random() * 5) + 3) {
    // Una entrada cada 3-8 días
    const entryDate = addDays(today, dayOffset)

    const clubIdx = Math.floor(Math.random() * clubs.length)
    const club = clubs[clubIdx]
    const staff = staffList[clubIdx]

    const clubProducts = await prisma.barProduct.findMany({
      where: { clubId: club.id, active: true },
    })

    if (clubProducts.length > 0) {
      const product = clubProducts[Math.floor(Math.random() * clubProducts.length)]
      const qty = Math.floor(Math.random() * 30) + 10
      const reasons = ['Compra', 'Ajuste', 'Daño']

      await prisma.barStockEntry.create({
        data: {
          clubId: club.id,
          productId: product.id,
          qty,
          reason: reasons[Math.floor(Math.random() * reasons.length)],
          staffId: staff.id,
          createdAt: entryDate,
        },
      })
      entriesCount++
    }
  }

  // ─────────────────────────────────────────────
  // SPECIAL HOURS — Horarios especiales M3.5
  // ─────────────────────────────────────────────

  console.log('\n📅 Creando horarios especiales (feriados, eventos)...')

  // Feriados y eventos para Club 1 (PadelClub Nueva Córdoba)
  const nowDate = new Date()
  nowDate.setUTCHours(0, 0, 0, 0)

  // 25 de Mayo (feriado)
  const may25 = new Date(nowDate.getUTCFullYear(), 4, 25)
  await prisma.specialHours.upsert({
    where: { clubId_date: { clubId: club1.id, date: may25 } },
    update: {},
    create: {
      clubId: club1.id,
      date: may25,
      reason: '25 de Mayo - Feriado Nacional',
      isClosed: true,
    },
  })

  // Torneo especial en Club 1
  const tournamentDate = new Date(nowDate)
  tournamentDate.setUTCDate(tournamentDate.getUTCDate() + 15)
  await prisma.specialHours.upsert({
    where: { clubId_date: { clubId: club1.id, date: tournamentDate } },
    update: {},
    create: {
      clubId: club1.id,
      date: tournamentDate,
      reason: 'Torneo Especial - Horario Extendido',
      isClosed: false,
      openTime: '08:00',
      closeTime: '23:00',
    },
  })

  // Mantenimiento en Club 2 (Racket Club)
  const maintenanceDate = new Date(nowDate)
  maintenanceDate.setUTCDate(maintenanceDate.getUTCDate() + 7)
  await prisma.specialHours.upsert({
    where: { clubId_date: { clubId: club2.id, date: maintenanceDate } },
    update: {},
    create: {
      clubId: club2.id,
      date: maintenanceDate,
      reason: 'Mantenimiento de canchas',
      isClosed: true,
    },
  })

  console.log(`✅ ${3} horarios especiales creados`)

  console.log('✅ Seed completado exitosamente:\n')
  console.log('👤 USUARIOS:')
  console.log(`  • SUPERADMIN: ${superadmin.email} (contraseña: admin1234)`)
  console.log(`  • OWNERs: ${owners.map((o) => o.email).join(', ')} (contraseña: owner1234)`)
  console.log(`  • STAFF: ${staffList.map((s) => s.email).join(', ')} (contraseña: staff1234)`)
  console.log(`  • PLAYERs: ${playersData.length} jugadores (contraseña: player1234)`)
  console.log(`\n🏟️  CLUBES: ${clubs.length}`)
  clubs.forEach((club, i) => {
    console.log(`  • ${i + 1}. ${club.name} (${owners[i].name})`)
    console.log(`     - Cancelación: ${club.cancelHoursBeforeStart}hs, Cargo: ${club.cancellationFeePercent}%`)
    console.log(`     - Duraciones: ${club.allowedDurations.join(', ')} min`)
  })
  console.log(`\n🎾 CANCHAS: ${allCourts.length} total`)
  console.log(`\n📋 BOOKINGS: ${bookingCount} en últimos 30 días`)
  console.log(`\n🛍️  BAR SALES: ${saleCount} en últimos 30 días`)
  console.log(`\n📦 STOCK ENTRIES: ${entriesCount} registros`)
  console.log(`\n✨ Achievements: 12`)
  console.log(
    `\n🥤 Productos de bar: ${baseProducts.length} × ${clubs.length} clubes = ${baseProducts.length * clubs.length} total`
  )
  console.log(`\n📅 HORARIOS ESPECIALES (M3.5): 3 ejemplos (feriados, eventos, mantenimiento)`)
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
