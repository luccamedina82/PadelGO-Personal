'use server'

import prisma from '@/lib/prisma'
import { generateRefreshTokenRaw, hashToken, hashPassword } from '@/lib/auth'
import { sendPasswordReset } from '@/lib/email'
import type { ActionResult } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── REQUEST PASSWORD RESET ────────────────────────────────────────────────

/**
 * Initiates a password reset flow by sending an email with a time-limited link.
 * Always returns success to avoid revealing whether an email exists (anti-enumeration).
 */
export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email) {
    return { success: false, error: 'El email es obligatorio.' }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isGhost: true },
  })

  // Ghost users have no password — silently skip, same as not found
  if (!user || user.isGhost) {
    return { success: true }
  }

  // Reuse the Invitation model (no schema migration needed).
  // clubId is required by FK — use first available club as a placeholder.
  // Token lookup is always by the unique tokenHash, never by clubId.
  const firstClub = await prisma.club.findFirst({ select: { id: true } })
  if (!firstClub) {
    // No clubs in DB (edge case in dev) — still return success silently
    return { success: true }
  }

  const rawToken = generateRefreshTokenRaw()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

  await prisma.invitation.create({
    data: {
      email: user.email,
      clubId: firstClub.id,
      invitedBy: user.id,
      token: tokenHash,
      expiresAt,
    },
  })

  const resetUrl = `${APP_URL}/reset-password/${rawToken}`

  if (process.env.NODE_ENV === 'development') {
    console.log('[passwordReset] reset URL:', resetUrl)
  }

  // Fire-and-forget: don't block the response on email delivery
  sendPasswordReset({ to: user.email, userName: user.name, resetUrl }).catch((err) => {
    console.error('[passwordReset] email error:', err)
  })

  return { success: true }
}

// ── RESET PASSWORD ────────────────────────────────────────────────────────

/**
 * Validates the reset token and updates the user's password.
 * Revokes all existing refresh tokens for security.
 */
export async function resetPassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const rawToken = formData.get('token') as string
  const newPassword = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!rawToken) {
    return { success: false, error: 'Token inválido.' }
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Las contraseñas no coinciden.' }
  }

  const tokenHash = hashToken(rawToken)

  const invitation = await prisma.invitation.findUnique({
    where: { token: tokenHash },
  })

  if (!invitation) {
    return { success: false, error: 'El link es inválido o ya fue usado.' }
  }

  if (invitation.expiresAt < new Date()) {
    return { success: false, error: 'El link expiró. Solicitá uno nuevo desde el login.' }
  }

  if (invitation.acceptedAt !== null) {
    return { success: false, error: 'Este link ya fue usado.' }
  }

  const hashedPwd = await hashPassword(newPassword)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    })
    if (!user) throw new Error('USER_NOT_FOUND')

    await tx.user.update({
      where: { id: user.id },
      data: { password: hashedPwd },
    })

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    })

    // Revoke all refresh tokens — forces re-login on all devices
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  })

  return { success: true }
}
