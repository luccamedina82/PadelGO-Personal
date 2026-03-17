import Link from 'next/link'
import Tag from '@/components/ui/Tag'
import type { ClubPublic } from '@/types'
import { formatPrice } from '@/lib/availability'

interface ClubCardProps {
  club: ClubPublic & { minPrice: number | null }
  variant?: 'default' | 'compact'
}

/** Deterministic gradient from club's RGB seed color */
function clubGradient(r: number, g: number, b: number): string {
  return `linear-gradient(135deg, rgba(${r},${g},${b},0.18) 0%, rgba(${r},${g},${b},0.06) 100%)`
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="flex items-center gap-0.5 text-accent">
      {'★'.repeat(full)}
      {half && '½'}
      <span className="text-sub">{'★'.repeat(empty)}</span>
    </span>
  )
}

export default function ClubCard({ club, variant = 'default' }: ClubCardProps) {
  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-border-hover transition-colors">
      {/* Gradient header */}
      <div
        className="h-28 relative flex items-end p-4"
        style={{ background: clubGradient(club.colorR, club.colorG, club.colorB) }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
        <div className="relative">
          <h3 className="font-display text-xl tracking-wide text-text leading-none">{club.name}</h3>
          <p className="text-xs text-muted mt-0.5">{club.zone}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Rating + price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StarRating rating={club.rating} />
            <span className="text-xs text-muted">({club.reviewCount})</span>
          </div>
          {club.minPrice != null && (
            <span className="font-mono text-sm text-accent font-semibold">
              desde {formatPrice(club.minPrice)}/hr
            </span>
          )}
        </div>

        {/* Tags */}
        {club.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {club.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
        )}

        {/* Vibe */}
        {variant === 'default' && <p className="text-xs text-muted line-clamp-1">{club.vibe}</p>}

        {/* CTA */}
        <Link
          href={`/club/${club.id}`}
          className="block w-full text-center py-2 rounded-lg bg-accent text-accent-text text-sm font-semibold hover:bg-accent-dark transition-colors"
        >
          Ver cancha
        </Link>
      </div>
    </div>
  )
}
