import { Suspense } from 'react'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { getSessionAndUserProfile } from '@/actions/auth'
import PublicLayout from '@/components/layout/PublicLayout'
import ClubCard from '@/components/club/ClubCard'
import { ClubCardSkeleton } from '@/components/ui/skeleton'
import HeroSearchBar from '@/components/layout/HeroSearchBar'
import ActivityTicker from '@/components/layout/ActivityTicker'
import type { ClubPublic } from '@/types'
import { argToday, argTomorrow } from '@/lib/date'
import { connection } from 'next/server'

// ── DATA FETCHING ─────────────────────────────────────────────────────────

function mapClub(club: {
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
  courts: { availabilities: { pricePerHour: number }[] }[]
}) {
  const allPrices = club.courts.flatMap((c) => c.availabilities.map((a) => a.pricePerHour))
  return {
    id: club.id,
    name: club.name,
    description: club.description,
    vibe: club.vibe,
    city: club.city,
    zone: club.zone,
    address: club.address,
    lat: club.lat,
    lng: club.lng,
    phone: club.phone,
    email: club.email,
    rating: club.rating,
    reviewCount: club.reviewCount,
    amenities: club.amenities,
    tags: club.tags,
    colorR: club.colorR,
    colorG: club.colorG,
    colorB: club.colorB,
    photos: club.photos,
    isActive: club.isActive,
    cancelHoursBeforeStart: club.cancelHoursBeforeStart,
    minPrice: allPrices.length > 0 ? Math.min(...allPrices) : null,
  } satisfies ClubPublic & { minPrice: number | null }
}

const COURTS_INCLUDE = {
  courts: {
    where: { isActive: true },
    include: { availabilities: { where: { isActive: true }, select: { pricePerHour: true } } },
  },
}

async function getFeaturedClubs() {
  await connection()
  const clubs = await prisma.club.findMany({
    where: { isActive: true },
    include: COURTS_INCLUDE,
    orderBy: { rating: 'desc' },
    take: 4,
  })
  return clubs.map(mapClub)
}

async function getAvailableTodayClubs() {
  await connection()
  const clubs = await prisma.club.findMany({
    where: { isActive: true },
    include: COURTS_INCLUDE,
    orderBy: { rating: 'desc' },
    take: 6,
  })
  return clubs.map(mapClub)
}

async function getPageData() {
  await connection()
  const today = argToday()
  const tomorrow = argTomorrow()
  const dow = today.getUTCDay()

  const [clubCount, totalBookings, confirmedToday, availabilities] = await Promise.all([
    prisma.club.count({ where: { isActive: true } }),
    prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'COMPLETED'] } } }),
    prisma.booking.count({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    }),
    prisma.courtAvailability.count({
      where: {
        court: { isActive: true, club: { isActive: true } },
        dayOfWeek: dow,
        isActive: true,
      },
    }),
  ])

  // Estimate available slots: each availability covers ~10 time slots on average
  const estimatedTotal = availabilities * 10
  const availableSlots = Math.max(0, estimatedTotal - confirmedToday)

  return { clubCount, totalBookings, availableSlots }
}

// ── PAGE ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <PublicLayout>
      <div className="min-h-screen">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(212,240,0,0.10) 0%, transparent 70%), var(--bg)',
            minHeight: 460,
          }}
        >
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: 0.03,
              backgroundImage:
                'linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          {/* Glow orb */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 700,
              height: 700,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,240,0,0.07) 0%, transparent 60%)',
              top: -280,
              right: -150,
            }}
          />

          <div
            className="relative z-10 max-w-[1360px] mx-auto px-10 pt-16 pb-16"
            style={{ paddingLeft: 40, paddingRight: 40 }}
          >
            {/* Badge */}
            <Suspense
              fallback={
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5 h-[28px] w-[280px] bg-accent/10 animate-pulse" />
              }
            >
              <HeroBadge />
            </Suspense>

            {/* Title */}
            <h1
              className="font-display leading-none mb-5"
              style={{
                fontSize: 'clamp(52px, 7.5vw, 92px)',
                letterSpacing: '0.04em',
                animation: 'fadeUp 0.45s 0.08s ease forwards',
                opacity: 0,
                maxWidth: 680,
              }}
            >
              TU PRÓXIMO
              <br />
              <span className="text-accent">PARTIDO</span>
              <br />
              TE ESPERA
            </h1>

            {/* Subtitle */}
            <p
              className="text-muted text-[15px] mb-8"
              style={{
                maxWidth: 480,
                lineHeight: 1.7,
                animation: 'fadeUp 0.45s 0.16s ease forwards',
                opacity: 0,
              }}
            >
              Reservá canchas en Córdoba, encontrá compañeros y subí tu nivel.
            </p>

            {/* SearchBar */}
            <div
              style={{
                maxWidth: 660,
                animation: 'fadeUp 0.45s 0.24s ease forwards',
                opacity: 0,
              }}
            >
              <Suspense
                fallback={
                  <div className="h-[64px] w-full bg-white/5 border border-white/10 rounded-full animate-pulse" />
                }
              >
                <HeroSearchBar />
              </Suspense>
            </div>
          </div>
        </section>

        {/* ── Activity ticker ───────────────────────────────────────────── */}
        <ActivityTicker />

        {/* ── Disponible hoy ────────────────────────────────────────────── */}
        <section
          className="max-w-[1360px] mx-auto pt-10 pb-4"
          style={{ paddingLeft: 40, paddingRight: 40 }}
        >
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="font-display text-[clamp(18px,2.5vw,28px)] tracking-widest text-text">
                DISPONIBLE HOY <span className="text-accent">· CÓRDOBA</span>
              </h2>
              <p className="text-xs text-muted mt-1">Reservá directo, sin esperas</p>
            </div>
            <Link
              href="/buscar"
              className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
            >
              Ver todos
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="min-w-[230px] max-w-[250px] flex-shrink-0">
                    <ClubCardSkeleton />
                  </div>
                ))}
              </div>
            }
          >
            <AvailableTodayScroll />
          </Suspense>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <section
          className="max-w-[1360px] mx-auto py-8"
          style={{ paddingLeft: 40, paddingRight: 40 }}
        >
          <Suspense
            fallback={
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-2xl h-[104px] animate-pulse"
                  />
                ))}
              </div>
            }
          >
            <PlatformStats />
          </Suspense>
        </section>

        {/* ── Clubes destacados ─────────────────────────────────────────── */}
        <section
          className="max-w-[1360px] mx-auto pb-10"
          style={{ paddingLeft: 40, paddingRight: 40 }}
        >
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="font-display text-[clamp(18px,2.5vw,28px)] tracking-widest text-text">
                CLUBES DESTACADOS <span className="text-accent">EN CÓRDOBA</span>
              </h2>
              <p className="text-xs text-muted mt-1">Los favoritos de la semana</p>
            </div>
            <Link
              href="/buscar"
              className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
            >
              Ver todos
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <ClubCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <FeaturedClubs />
          </Suspense>
        </section>

        {/* ── Explorá por zona ──────────────────────────────────────────── */}
        <section
          className="max-w-[1360px] mx-auto pb-16"
          style={{ paddingLeft: 40, paddingRight: 40 }}
        >
          <h2 className="font-display text-[clamp(18px,2.5vw,28px)] tracking-widest text-text mb-1.5">
            EXPLORÁ POR <span className="text-accent">ZONA</span>
          </h2>
          <p className="text-xs text-muted mb-5">Clubes cerca de tu barrio</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              'Nueva Córdoba',
              'Güemes',
              'Cerro de las Rosas',
              'General Paz',
              'Urca',
              'Alberdi',
            ].map((zone) => (
              <Link
                key={zone}
                href={`/buscar?zona=${encodeURIComponent(zone)}`}
                className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3.5 hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-150"
              >
                <div>
                  <p className="font-semibold text-text text-sm">{zone}</p>
                  <p className="text-[11px] text-muted mt-0.5">Ver clubes →</p>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted flex-shrink-0"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Features strip ────────────────────────────────────────────── */}
        <section
          className="max-w-[1360px] mx-auto pb-20"
          style={{ paddingLeft: 40, paddingRight: 40 }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: '📅',
                title: 'Reserva en segundos',
                desc: 'Elegí fecha, horario y cancha sin complicaciones.',
              },
              {
                icon: '🎾',
                title: 'Open Match',
                desc: 'Encontrá compañeros de juego de tu nivel.',
              },
              { icon: '🏆', title: 'Ranking local', desc: 'Competí con los jugadores de tu zona.' },
            ].map((f) => (
              <div key={f.title} className="flex gap-3">
                <span className="text-2xl flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-text">{f.title}</p>
                  <p className="text-xs text-muted mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </PublicLayout>
  )
}

// ── Async sub-components ───────────────────────────────────────────────────

async function HeroBadge() {
  const { user } = await getSessionAndUserProfile()
  const { availableSlots } = await getPageData()
  const firstName = user?.name?.split(' ')[0] ?? null

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5 text-[11px] font-bold uppercase tracking-widest"
      style={{
        background: 'rgba(212,240,0,0.07)',
        border: '1px solid rgba(212,240,0,0.18)',
        color: 'var(--accent)',
        animation: 'fadeUp 0.45s 0s ease forwards',
        opacity: 0, // Animación CSS que ya tenías
      }}
    >
      {firstName ? (
        <>
          <span>⚡</span>
          Hola de nuevo, {firstName} — {availableSlots} turnos libres cerca tuyo
        </>
      ) : (
        <>
          <span>⚡</span>
          {availableSlots} turnos disponibles ahora en Córdoba
        </>
      )}
    </div>
  )
}

async function PlatformStats() {
  const { clubCount, totalBookings, availableSlots } = await getPageData()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { n: String(clubCount), l: 'Clubes en Córdoba', i: '🏟️' },
        { n: String(availableSlots), l: 'Turnos ahora', i: '⚡' },
        { n: `${totalBookings}+`, l: 'Reservas totales', i: '🎾' },
        { n: '4.8', l: 'Rating promedio', i: '⭐' },
      ].map((s, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-2xl px-5 py-4"
          style={{ animation: `fadeIn 0.3s ${0.08 * i}s ease forwards`, opacity: 0 }}
        >
          <div className="text-xl mb-2">{s.i}</div>
          <div className="font-display text-[28px] tracking-widest text-accent leading-none">
            {s.n}
          </div>
          <div className="text-[11px] text-muted mt-1">{s.l}</div>
        </div>
      ))}
    </div>
  )
}

async function FeaturedClubs() {
  const clubs = await getFeaturedClubs()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} />
      ))}
    </div>
  )
}

async function AvailableTodayScroll() {
  const clubs = await getAvailableTodayClubs()
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      style={{ scrollbarWidth: 'none', marginLeft: -2, paddingLeft: 2 }}
    >
      {clubs.map((club) => (
        <div key={club.id} className="min-w-[230px] max-w-[250px] flex-shrink-0">
          <ClubCard club={club} />
        </div>
      ))}
    </div>
  )
}
