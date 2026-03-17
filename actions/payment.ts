'use server'

import { requireAuth } from '@/actions/auth'
import prisma from '@/lib/prisma'
import type { ActionResult } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const MP_API = 'https://api.mercadopago.com'

// ── CREATE PREFERENCE ─────────────────────────────────────────────────────

/**
 * Creates a Mercado Pago Checkout Pro preference for a PENDING booking.
 * Returns the init_point URL to redirect the user to MP's checkout.
 *
 * Flow: Booking PENDING → createMercadoPagoPreference → user pays on MP →
 *        webhook /api/webhooks/mp → booking CONFIRMED + email sent
 */
export async function createMercadoPagoPreference(
  bookingId: string
): Promise<ActionResult<{ initPoint: string; preferenceId: string }>> {
  const session = await requireAuth()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentStatus: true,
      totalPrice: true,
      startTime: true,
      durationMinutes: true,
      club: { select: { name: true } },
      court: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  })

  if (!booking) return { success: false, error: 'Reserva no encontrada.' }
  if (booking.userId !== session.userId) return { success: false, error: 'Sin permisos.' }
  if (booking.status !== 'PENDING') {
    return { success: false, error: 'Esta reserva no está pendiente de pago.' }
  }
  if (booking.paymentStatus === 'PAID') {
    return { success: false, error: 'Esta reserva ya fue pagada.' }
  }

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    return { success: false, error: 'Pagos no configurados. Contactá al soporte.' }
  }

  const endMinutes =
    parseInt(booking.startTime.split(':')[0] ?? '0', 10) * 60 +
    parseInt(booking.startTime.split(':')[1] ?? '0', 10) +
    booking.durationMinutes
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

  const title = `${booking.club.name} · ${booking.court.name} ${booking.startTime}–${endTime}`

  try {
    const response = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            id: bookingId,
            title,
            quantity: 1,
            unit_price: booking.totalPrice,
            currency_id: 'ARS',
          },
        ],
        payer: {
          email: booking.user.email,
          name: booking.user.name,
        },
        external_reference: bookingId,
        back_urls: {
          success: `${APP_URL}/confirmar/${bookingId}?pago=ok`,
          failure: `${APP_URL}/confirmar/${bookingId}?pago=error`,
          pending: `${APP_URL}/confirmar/${bookingId}?pago=pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${APP_URL}/api/webhooks/mp`,
        // Expires in 1 hour
        expiration_date_to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[createMercadoPagoPreference] MP API error:', err)
      return { success: false, error: 'Error al conectar con Mercado Pago.' }
    }

    const data = (await response.json()) as { id: string; init_point: string }

    // Store the preference ID on the booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentId: data.id },
    })

    return {
      success: true,
      data: {
        initPoint: data.init_point,
        preferenceId: data.id,
      },
    }
  } catch (err) {
    console.error('[createMercadoPagoPreference]', err)
    return { success: false, error: 'Error al procesar el pago. Intentá de nuevo.' }
  }
}

// ── SET MANUAL PAYMENT ─────────────────────────────────────────────────────

/**
 * Marks a booking as MANUAL payment (cash at club).
 * Sets status to CONFIRMED and paymentStatus to MANUAL.
 * Can only be called by the booking owner while status is PENDING.
 */
export async function setManualPayment(
  bookingId: string
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireAuth()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentStatus: true,
      clubId: true,
    },
  })

  if (!booking) return { success: false, error: 'Reserva no encontrada.' }
  if (booking.userId !== session.userId) return { success: false, error: 'Sin permisos.' }
  if (booking.status !== 'PENDING') {
    return { success: false, error: 'Esta reserva ya no está pendiente.' }
  }
  if (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'MANUAL') {
    return { success: false, error: 'Esta reserva ya fue procesada.' }
  }

  try {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'MANUAL',
      },
    })

    const { revalidateTag } = await import('next/cache')
    revalidateTag(`club-${booking.clubId}`, 'default')

    return { success: true, data: { bookingId } }
  } catch (err) {
    console.error('[setManualPayment]', err)
    return { success: false, error: 'Error al procesar. Intentá de nuevo.' }
  }
}

// ── SET MANUAL PAYMENT FOR GUEST ───────────────────────────────────────────

/**
 * Marks a guest booking as MANUAL payment (cash at club).
 * Does not require authentication - validates by bookingId only.
 * Used for guest checkout flow.
 */
export async function setGuestManualPayment(
  bookingId: string
): Promise<ActionResult<{ bookingId: string }>> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      clubId: true,
      user: { select: { isGhost: true } },
    },
  })

  if (!booking) return { success: false, error: 'Reserva no encontrada.' }
  if (!booking.user.isGhost) {
    return { success: false, error: 'Esta función es solo para usuarios invitados.' }
  }
  if (booking.status !== 'PENDING') {
    return { success: false, error: 'Esta reserva ya no está pendiente.' }
  }
  if (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'MANUAL') {
    return { success: false, error: 'Esta reserva ya fue procesada.' }
  }

  try {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'MANUAL',
      },
    })

    const { revalidateTag } = await import('next/cache')
    revalidateTag(`club-${booking.clubId}`, 'default')

    return { success: true, data: { bookingId } }
  } catch (err) {
    console.error('[setGuestManualPayment]', err)
    return { success: false, error: 'Error al procesar. Intentá de nuevo.' }
  }
}
