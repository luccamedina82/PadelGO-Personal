import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import PublicLayout from '@/components/layout/PublicLayout'
import BookingWizard from '@/components/booking/BookingWizard'
import Tag from '@/components/ui/Tag'
import { createBooking, createGhostBooking } from '@/actions/booking'
import { createMercadoPagoPreference, setManualPayment, setGuestManualPayment } from '@/actions/payment'
import { getSession } from '@/actions/auth'
import type { CourtForWizard, BookingMap } from '@/components/booking/BookingWizard'
import { formatPrice } from '@/lib/availability'
import type { AvailabilityConfig } from '@/lib/availability'
import { argToday } from '@/lib/date'

// ── DATA FETCHING ──────────────────────────────────────────────────────────

/**
 * Club static data is ISR-cached with a per-club tag so individual clubs can be
 * invalidated on demand via revalidateTag(`club-${id}`).
 * Fallback revalidation: 1 hour.
 */
function getClubData(id: string) {
  return unstable_cache(
    async () =>
      prisma.club.findUnique({
        where: { id, isActive: true },
        include: {
          courts: {
            where: { isActive: true },
            include: {
              availabilities: { where: { isActive: true } },
            },
            orderBy: { name: 'asc' },
          },
        },
      }),
    [`club-data-${id}`],
    { tags: [`club-${id}`], revalidate: 3600 }
  )()
}

async function getExistingBookings(courtIds: string[]): Promise<BookingMap> {
  if (courtIds.length === 0) return {}

  const from = argToday() // Permite reservas a partir de hoy

  const to = new Date(from)
  to.setUTCDate(from.getUTCDate() + 14) // D+14 inclusive

  const bookings = await prisma.booking.findMany({
    where: {
      courtId: { in: courtIds },
      date: { gte: from, lt: to },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      courtId: true,
      date: true,
      startTime: true,
      durationMinutes: true,
      status: true,
    },
  })

  // Group by courtId → dateStr → bookings
  const map: BookingMap = {}
  for (const b of bookings) {
    const dateStr = b.date.toISOString().split('T')[0]
    if (!map[b.courtId]) map[b.courtId] = {}
    if (!map[b.courtId][dateStr]) map[b.courtId][dateStr] = []
    map[b.courtId][dateStr].push({
      startTime: b.startTime,
      durationMinutes: b.durationMinutes,
      status: b.status,
    })
  }
  return map
}

// ── PAGE ───────────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://padelgo.ar'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const club = await getClubData(id)

  if (!club) {
    return { title: 'Club no encontrado — PadelGo' }
  }

  const title = `${club.name} — PadelGo`
  const description =
    club.description ||
    `Reservá canchas en ${club.name}, ${club.zone}. ${club.reviewCount} reseñas.`

  return {
    title,
    description,
    openGraph: {
      title: club.name,
      description,
      url: `${APP_URL}/club/${id}`,
      siteName: 'PadelGo',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: `${APP_URL}/club/${id}`,
    },
  }
}

export default async function ClubPage({ params }: PageProps) {
  // Next.js 16: params is a Promise (P6)
  const { id } = await params
  const club = await getClubData(id)

  if (!club) notFound()

  const [session, existingBookings] = await Promise.all([
    getSession(),
    getExistingBookings(club.courts.map((c) => c.id)),
  ])
  // Build CourtForWizard[] — include availabilityByDay
  const courtsForWizard: CourtForWizard[] = club.courts.map((court) => {
    const availabilityByDay: Record<number, AvailabilityConfig> = {}
    for (const avail of court.availabilities) {
      availabilityByDay[avail.dayOfWeek] = {
        openTime: avail.openTime,
        closeTime: avail.closeTime,
        pricePerHour: avail.pricePerHour,
      }
    }
    return {
      id: court.id,
      name: court.name,
      type: court.type,
      covered: court.covered,
      svgX: court.svgX,
      svgY: court.svgY,
      svgW: court.svgW,
      svgH: court.svgH,
      isActive: court.isActive,
      availabilityByDay,
    }
  })

  // Min price across all courts and availabilities
  const allPrices = club.courts.flatMap((c) => c.availabilities.map((a) => a.pricePerHour))
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : null

  // Gradient from club RGB seed
  const gradient = `linear-gradient(135deg, rgba(${club.colorR},${club.colorG},${club.colorB},0.2) 0%, rgba(${club.colorR},${club.colorG},${club.colorB},0.05) 100%)`

  return (
    <PublicLayout>
      <div className="min-h-screen pb-16">
        {/* Hero header */}
        <div
          className="h-40 md:h-52 relative flex items-end px-6 pb-5"
          style={{ background: gradient }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
          <div className="relative">
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-text leading-none">
              {club.name}
            </h1>
            <p className="text-sm text-muted mt-1">
              {club.zone} · {club.city}
            </p>
          </div>
        </div>

        <div className="px-4 md:px-8 pt-6">
          <div className="flex flex-col xl:flex-row gap-8">
            {/* ── Left: Club Info ─────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Rating + price */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-accent text-lg">
                    {'★'.repeat(Math.round(club.rating))}
                    <span className="text-sub">{'★'.repeat(5 - Math.round(club.rating))}</span>
                  </span>
                  <span className="text-sm text-muted">({club.reviewCount} reseñas)</span>
                </div>
                {minPrice != null && (
                  <span className="font-mono text-sm text-accent font-semibold">
                    desde {formatPrice(minPrice)}/hr
                  </span>
                )}
              </div>

              {/* Vibe + description */}
              <div>
                <p className="text-sm font-semibold text-text">{club.vibe}</p>
                <p className="text-sm text-muted mt-2 leading-relaxed">{club.description}</p>
              </div>

              {/* Tags */}
              {club.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {club.tags.map((tag) => (
                    <Tag key={tag} label={tag} />
                  ))}
                </div>
              )}

              {/* Amenities */}
              {club.amenities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-sub tracking-widest uppercase mb-2">
                    Servicios
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {club.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="px-2.5 py-1 text-xs bg-surface border border-border rounded-lg text-muted"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Courts info */}
              <div>
                <p className="text-xs font-semibold text-sub tracking-widest uppercase mb-2">
                  Canchas ({club.courts.length})
                </p>
                <div className="space-y-2">
                  {club.courts.map((court) => (
                    <div
                      key={court.id}
                      className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-text">{court.name}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {court.covered ? 'Techada' : 'Exterior'} · {court.type}
                        </p>
                      </div>
                      {court.availabilities.length > 0 && (
                        <span className="font-mono text-xs text-accent">
                          desde{' '}
                          {formatPrice(
                            Math.min(...court.availabilities.map((a) => a.pricePerHour))
                          )}
                          /hr
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm">
                <p className="text-xs font-semibold text-sub tracking-widest uppercase mb-2">
                  Contacto
                </p>
                <p className="text-muted">
                  <span className="text-text">Dirección:</span> {club.address}
                </p>
                <p className="text-muted">
                  <span className="text-text">Teléfono:</span> {club.phone}
                </p>
                <p className="text-muted">
                  <span className="text-text">Email:</span> {club.email}
                </p>
              </div>

              {/* Cancellation policy */}
              <p className="text-xs text-sub">
                Cancelación gratuita hasta {club.cancelHoursBeforeStart} horas antes del turno.
              </p>
            </div>

            {/* ── Right: Booking Wizard ───────────────────── */}
            <div className="xl:w-96 flex-shrink-0">
              <div className="sticky top-4">
                <h2 className="font-display text-xl tracking-widest text-text mb-3">RESERVAR</h2>
                {courtsForWizard.length > 0 ? (
                  <BookingWizard
                    clubId={club.id}
                    clubName={club.name}
                    cancelHoursBeforeStart={club.cancelHoursBeforeStart}
                    courts={courtsForWizard}
                    existingBookings={existingBookings}
                    userId={session?.userId ?? null}
                    createBookingAction={createBooking}
                    createGhostBookingAction={createGhostBooking}
                    createMercadoPagoPreferenceAction={createMercadoPagoPreference}
                    setManualPaymentAction={setManualPayment}
                    setGuestManualPaymentAction={setGuestManualPayment}
                  />
                ) : (
                  <div className="bg-card border border-border rounded-2xl p-6 text-center">
                    <p className="text-2xl mb-2">🏟️</p>
                    <p className="text-sm text-muted">
                      Este club no tiene canchas disponibles en este momento.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
