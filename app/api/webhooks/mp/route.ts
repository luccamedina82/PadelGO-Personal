import { type NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { sendBookingConfirmation, sendBookingCancellation } from '@/lib/email'
import { formatPrice, minutesToTime, timeToMinutes } from '@/lib/availability'

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

function formatDateLabel(date: Date): string {
  const day = DAY_NAMES[date.getUTCDay()]
  const dd = date.getUTCDate()
  const month = MONTH_NAMES[date.getUTCMonth()]
  return `${day} ${dd} de ${month}`
}

/**
 * Verifies the Mercado Pago webhook signature.
 * Header format: x-signature: ts=<timestamp>,v1=<hmac>
 * Manifest: "id:<notification_id>;request-id:<x-request-id>;ts:<ts>;"
 */
function verifyMpSignature(
  signature: string | null,
  requestId: string | null,
  dataId: string | null,
  secret: string
): boolean {
  if (!signature || !requestId || !dataId) return false

  const tsMatch = signature.match(/ts=(\d+)/)
  const v1Match = signature.match(/v1=([a-f0-9]+)/)
  if (!tsMatch?.[1] || !v1Match?.[1]) return false

  const ts = tsMatch[1]
  const receivedHash = v1Match[1]
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`

  const expectedHash = createHmac('sha256', secret).update(manifest).digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (expectedHash.length !== receivedHash.length) return false
  let mismatch = 0
  for (let i = 0; i < expectedHash.length; i++) {
    mismatch |= expectedHash.charCodeAt(i) ^ receivedHash.charCodeAt(i)
  }
  return mismatch === 0
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.MP_WEBHOOK_SECRET
  const accessToken = process.env.MP_ACCESS_TOKEN

  if (!webhookSecret || !accessToken) {
    console.error('[mp-webhook] Missing MP_WEBHOOK_SECRET or MP_ACCESS_TOKEN')
    // Return 200 to avoid MP retrying indefinitely in misconfigured environments
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
    console.log(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Verify signature ───────────────────────────────────────────────────
  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')
  const dataId = (body.data as Record<string, unknown>)?.id as string | undefined

  if (!verifyMpSignature(xSignature, xRequestId, dataId ?? null, webhookSecret)) {
    console.warn('[mp-webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── Handle events ──────────────────────────────────────────────────────
  const topic = body.type as string | undefined
  const action = body.action as string | undefined

  // We only process payment approval events
  if (topic !== 'payment' || (action !== 'payment.created' && action !== 'payment.updated')) {
    return NextResponse.json({ ok: true })
  }

  const paymentId = dataId
  if (!paymentId) return NextResponse.json({ ok: true })

  try {
    // Fetch payment details from MP API
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 },
    })

    if (!paymentRes.ok) {
      console.error('[mp-webhook] Failed to fetch payment', paymentId)
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    const payment = (await paymentRes.json()) as {
      status: string
      external_reference: string
      status_detail: string
    }

    const bookingId = payment.external_reference
    if (!bookingId) {
      return NextResponse.json({ ok: true })
    }

    // ── Approved → confirm booking ──────────────────────────────────────
    if (payment.status === 'approved') {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          startTime: true,
          durationMinutes: true,
          totalPrice: true,
          date: true,
          clubId: true,
          club: { select: { name: true, address: true } },
          court: { select: { name: true } },
          user: { select: { email: true, name: true } },
        },
      })

      if (!booking) {
        console.warn('[mp-webhook] Booking not found:', bookingId)
        return NextResponse.json({ ok: true })
      }

      // Idempotency: skip if already processed
      if (booking.status === 'CONFIRMED' && booking.paymentStatus === 'PAID') {
        return NextResponse.json({ ok: true })
      }

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          paymentId,
        },
      })

      // Invalidate ISR cache for this club
      revalidateTag(`club-${booking.clubId}`, 'default')

      // Send confirmation email (non-blocking — fire and forget in background)
      const endMinutes = timeToMinutes(booking.startTime) + booking.durationMinutes
      const endTime = minutesToTime(endMinutes)
      const dateLabel = formatDateLabel(booking.date)

      try {
        await sendBookingConfirmation({
          to: booking.user.email,
          userName: booking.user.name,
          clubName: booking.club.name,
          clubAddress: booking.club.address,
          courtName: booking.court.name,
          date: dateLabel,
          startTime: booking.startTime,
          endTime,
          totalPrice: formatPrice(booking.totalPrice),
          bookingId: booking.id,
        })
      } catch (emailErr) {
        // Email failure should not fail the webhook
        console.error('[mp-webhook] Email send failed:', emailErr)
      }
    }

    // ── Refunded / cancelled → update status ──────────────────────────────
    if (payment.status === 'refunded' || payment.status === 'cancelled') {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          clubId: true,
          startTime: true,
          date: true,
          court: { select: { name: true } },
          club: { select: { name: true } },
          user: { select: { email: true, name: true } },
        },
      })

      if (!booking || booking.status === 'CANCELLED') {
        return NextResponse.json({ ok: true })
      }

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'REFUNDED',
        },
      })

      revalidateTag(`club-${booking.clubId}`, 'default')

      const dateLabel = formatDateLabel(booking.date)

      try {
        await sendBookingCancellation({
          to: booking.user.email,
          userName: booking.user.name,
          clubName: booking.club.name,
          courtName: booking.court.name,
          date: dateLabel,
          startTime: booking.startTime,
        })
      } catch (emailErr) {
        console.error('[mp-webhook] Cancellation email failed:', emailErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[mp-webhook] Unhandled error:', err)
    // Return 200 to prevent MP from retrying
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
