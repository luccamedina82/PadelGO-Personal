'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import type { ActionResult } from '@/types'

/**
 * Create or update a review for a club.
 * C-13: Only allowed for users with at least one COMPLETED booking at this club.
 * @@unique([userId, clubId]) — one review per user per club.
 */
export async function createReview(
  clubId: string,
  rating: number,
  comment?: string
): Promise<ActionResult> {
  const session = await requireAuth()

  if (!clubId) return { success: false, error: 'Club no especificado.' }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { success: false, error: 'La puntuación debe ser entre 1 y 5.' }
  }

  try {
    // C-13: Verify the user has at least one COMPLETED booking at this club
    const completedBooking = await prisma.booking.findFirst({
      where: {
        userId: session.userId,
        clubId,
        status: 'COMPLETED',
      },
      select: { id: true },
    })

    if (!completedBooking) {
      return {
        success: false,
        error: 'Solo podés reseñar clubes donde hayas completado una reserva.',
      }
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    })

    if (!club) return { success: false, error: 'Club no encontrado.' }

    // Upsert: update if exists, create if not (handles the @@unique constraint)
    const existing = await prisma.review.findUnique({
      where: { userId_clubId: { userId: session.userId, clubId } },
      select: { id: true, rating: true },
    })

    if (existing) {
      // Update existing review
      await prisma.$transaction(async (tx) => {
        await tx.review.update({
          where: { id: existing.id },
          data: { rating, comment: comment?.trim() ?? null },
        })

        // Recalculate club rating
        const reviews = await tx.review.findMany({
          where: { clubId },
          select: { rating: true },
        })
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        await tx.club.update({
          where: { id: clubId },
          data: { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length },
        })
      })
    } else {
      // Create new review
      await prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            userId: session.userId,
            clubId,
            rating,
            comment: comment?.trim() ?? null,
          },
        })

        // Recalculate club rating
        const reviews = await tx.review.findMany({
          where: { clubId },
          select: { rating: true },
        })
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        await tx.club.update({
          where: { id: clubId },
          data: { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length },
        })
      })
    }

    revalidateTag(`club-${clubId}`, 'default')
    revalidatePath(`/club/${clubId}`)

    return { success: true }
  } catch (err) {
    console.error('[createReview]', err)
    return { success: false, error: 'Error al guardar la reseña.' }
  }
}

/**
 * Get the authenticated user's review for a specific club.
 */
export async function getUserClubReview(
  clubId: string
): Promise<{ rating: number; comment: string | null } | null> {
  const session = await requireAuth()

  const review = await prisma.review.findUnique({
    where: { userId_clubId: { userId: session.userId, clubId } },
    select: { rating: true, comment: true },
  })

  return review
}
