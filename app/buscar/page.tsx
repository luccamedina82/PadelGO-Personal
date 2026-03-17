import prisma from '@/lib/prisma'
import PublicLayout from '@/components/layout/PublicLayout'
import ClubGrid from '@/components/club/ClubGrid'
import MapView from '@/components/club/MapView'
import SearchFilters from './SearchFilters'
import type { ClubPublic } from '@/types'

// ── TYPES ─────────────────────────────────────────────────────────────────

type SearchParams = {
  zona?: string
  q?: string
  techado?: string
  premium?: string
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

// ── DATA FETCHING ──────────────────────────────────────────────────────────

async function getClubs(params: SearchParams) {
  const where: Record<string, unknown> = { isActive: true }

  if (params.zona) {
    where.zone = params.zona
  }

  if (params.q) {
    where.name = { contains: params.q, mode: 'insensitive' }
  }

  if (params.techado === '1') {
    where.courts = { some: { covered: true, isActive: true } }
  }

  if (params.premium === '1') {
    where.tags = { has: 'Premium' }
  }

  const clubs = await prisma.club.findMany({
    where,
    include: {
      courts: {
        where: { isActive: true },
        include: { availabilities: { where: { isActive: true } } },
      },
    },
    orderBy: { rating: 'desc' },
  })

  return clubs.map((club) => {
    const allPrices = club.courts.flatMap((c) => c.availabilities.map((a) => a.pricePerHour))
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : null
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
      minPrice,
    } satisfies ClubPublic & { minPrice: number | null }
  })
}

// ── PAGE ───────────────────────────────────────────────────────────────────

export default async function BuscarPage({ searchParams }: PageProps) {
  // Next.js 16: searchParams is a Promise (P6)
  const params = await searchParams
  const clubs = await getClubs(params)

  const hasFilters = !!(params.zona || params.q || params.techado || params.premium)

  return (
    <PublicLayout>
      <div className="min-h-screen px-4 md:px-8 pt-8 pb-16 max-w-[1360px] mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="font-display text-3xl md:text-4xl tracking-widest text-text">
            BUSCAR CANCHA
          </h1>
          <p className="text-sm text-muted mt-1">
            {clubs.length} {clubs.length === 1 ? 'club encontrado' : 'clubes encontrados'}
            {hasFilters && ' con esos filtros'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <SearchFilters initialParams={params} />
        </div>

        {/* Results + Map split */}
        <div className="flex gap-6 items-start">
          {/* Club grid (flex 1) */}
          <div className="flex-1 min-w-0">
            <ClubGrid
              clubs={clubs}
              emptyMessage={
                hasFilters
                  ? 'No se encontraron clubes con esos filtros.'
                  : 'No hay clubes disponibles en este momento.'
              }
            />
          </div>

          {/* Sticky map — visible only on xl+ */}
          {clubs.length > 0 && (
            <div className="hidden xl:block w-80 flex-shrink-0 sticky top-[80px]">
              <MapView clubs={clubs} />
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
