import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import { formatPrice, minutesToTime, timeToMinutes } from '@/lib/availability'
import ReviewForm from '@/components/reviews/ReviewForm'

// ── HELPERS ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function formatDuration(minutes: number): string {
  if (minutes === 60) return '1 hora'
  if (minutes === 90) return '1h 30min'
  if (minutes === 120) return '2 horas'
  return `${minutes} min`
}

function buildWhatsAppText(params: {
  clubName: string
  courtName: string
  date: Date
  startTime: string
  endTime: string
  address: string
}): string {
  const { clubName, courtName, date, startTime, endTime, address } = params
  const day = DAY_NAMES[date.getUTCDay()]
  const dd = date.getUTCDate()
  const month = MONTH_NAMES[date.getUTCMonth()]

  const text =
    `🎾 ¡Reservé cancha en ${clubName}!\n` +
    `📅 ${day} ${dd} de ${month}\n` +
    `⏰ ${startTime} – ${endTime}\n` +
    `🏟 ${courtName}\n` +
    `📍 ${address}\n\n` +
    `¿Venís? Reservá en PadelGo 👇`

  return encodeURIComponent(text)
}

// ── PAGE ───────────────────────────────────────────────────────────────────

type PageProps = { params: Promise<{ id: string }> }

export default async function ConfirmarPage({ params }: PageProps) {
  const session = await requireAuth()
  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      club: { select: { name: true, address: true, zone: true, id: true } },
      court: { select: { name: true, type: true, covered: true } },
    },
  })

  if (!booking || booking.userId !== session.userId) notFound()

  // Fetch existing review if booking is completed
  const existingReview =
    booking.status === 'COMPLETED'
      ? await prisma.review.findUnique({
          where: { userId_clubId: { userId: session.userId, clubId: booking.club.id } },
          select: { rating: true, comment: true },
        })
      : null

  const endMinutes = timeToMinutes(booking.startTime) + booking.durationMinutes
  const endTime = minutesToTime(endMinutes)
  const waText = buildWhatsAppText({
    clubName: booking.club.name,
    courtName: booking.court.name,
    date: booking.date,
    startTime: booking.startTime,
    endTime,
    address: booking.club.address,
  })

  const dayLabel = DAY_NAMES[booking.date.getUTCDay()]
  const dd = booking.date.getUTCDate()
  const monthLabel = MONTH_NAMES[booking.date.getUTCMonth()]

  const statusLabel: Record<string, string> = {
    PENDING: 'Pendiente de pago',
    CONFIRMED: 'Confirmada',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
  }
  const statusColor: Record<string, string> = {
    PENDING: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    CONFIRMED: 'text-accent bg-accent/10 border-accent/20',
    COMPLETED: 'text-green-400 bg-green-400/10 border-green-400/20',
    CANCELLED: 'text-red-400 bg-red-400/10 border-red-400/20',
  }

  return (
    <div className="min-h-screen px-4 md:px-8 pt-8 pb-16 max-w-lg mx-auto">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🎾</div>
        <h1 className="font-display text-4xl tracking-widest text-text">RESERVA LISTA</h1>
        <p className="text-sm text-muted mt-2">Tu turno está confirmado</p>
      </div>

      {/* Booking card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
        {/* Club header */}
        <div className="bg-accent/10 border-b border-border px-5 py-4">
          <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-0.5">
            {booking.club.zone}
          </p>
          <h2 className="font-display text-2xl tracking-wide text-text">{booking.club.name}</h2>
          <p className="text-xs text-muted mt-0.5">{booking.club.address}</p>
        </div>

        {/* Details grid */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-sub uppercase tracking-wider mb-1">Fecha</p>
              <p className="text-sm font-semibold text-text">
                {dayLabel} {dd} de {monthLabel}
              </p>
            </div>
            <div>
              <p className="text-xs text-sub uppercase tracking-wider mb-1">Horario</p>
              <p className="font-mono text-sm font-semibold text-text">
                {booking.startTime} – {endTime}
              </p>
            </div>
            <div>
              <p className="text-xs text-sub uppercase tracking-wider mb-1">Cancha</p>
              <p className="text-sm font-semibold text-text">{booking.court.name}</p>
              <p className="text-xs text-muted">
                {booking.court.covered ? 'Techada' : 'Exterior'} · {booking.court.type}
              </p>
            </div>
            <div>
              <p className="text-xs text-sub uppercase tracking-wider mb-1">Duración</p>
              <p className="text-sm font-semibold text-text">
                {formatDuration(booking.durationMinutes)}
              </p>
            </div>
          </div>

          {/* Total + status */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div>
              <p className="text-xs text-sub uppercase tracking-wider mb-1">Total</p>
              <p className="font-mono text-xl font-semibold text-accent">
                {formatPrice(booking.totalPrice)}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${statusColor[booking.status] ?? ''}`}
              >
                {statusLabel[booking.status] ?? booking.status}
              </span>
              {booking.paymentStatus === 'MANUAL' && (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full border text-amber-400 bg-amber-400/10 border-amber-400/20">
                  💵 Efectivo
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cash payment reminder */}
      {booking.paymentStatus === 'MANUAL' && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-xl">💵</span>
            <div>
              <p className="font-semibold text-sm text-text">Recordá pagar en el club</p>
              <p className="text-xs text-muted mt-1">
                Abonás {formatPrice(booking.totalPrice)} cuando llegues. Llevá efectivo o consultá
                los medios de pago del club.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {/* WhatsApp share */}
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1ebe5d] transition-colors"
        >
          <span>💬</span>
          Compartir por WhatsApp
        </a>

        {/* Publish as open match */}
        <Link
          href="/open-match"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-card border border-border text-text text-sm font-semibold hover:border-border-hover transition-colors"
        >
          <span>📣</span>
          Publicar como Open Match
        </Link>

        {/* Go to historial */}
        <Link
          href="/historial"
          className="block w-full text-center py-3 text-sm text-muted hover:text-text transition-colors"
        >
          Ver mis reservas →
        </Link>
      </div>

      {/* Review form — shown after completed bookings */}
      {booking.status === 'COMPLETED' && (
        <div className="mt-6">
          <ReviewForm
            clubId={booking.club.id}
            clubName={booking.club.name}
            initialRating={existingReview?.rating ?? undefined}
            initialComment={existingReview?.comment ?? null}
          />
        </div>
      )}
    </div>
  )
}
