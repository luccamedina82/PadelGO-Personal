'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireSuperAdmin } from '@/actions/auth'
import { createAuditLog } from '@/lib/audit'
import { generateRefreshTokenRaw, hashToken } from '@/lib/auth'
import { sendPasswordReset } from '@/lib/email'
import type { ActionResult } from '@/types'

// ── BAN USER ──────────────────────────────────────────────────────────────────

export async function banUser(userId: string, reason: string): Promise<ActionResult> {
  const session = await requireSuperAdmin()

  if (!reason?.trim()) {
    return { success: false, error: 'El motivo del ban es obligatorio.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true, isBanned: true },
      })

      if (!user) throw new Error('NOT_FOUND')
      if (user.role === 'SUPERADMIN') throw new Error('CANNOT_BAN_SUPERADMIN')
      if (user.isBanned) throw new Error('ALREADY_BANNED')

      await tx.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          bannedAt: new Date(),
          bannedReason: reason.trim(),
        },
      })

      // Revoke all refresh tokens to force logout
      await tx.refreshToken.deleteMany({ where: { userId } })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'BAN_USER',
        entityType: 'User',
        entityId: userId,
        metadata: { userName: user.name, reason: reason.trim() },
      })
    })

    revalidatePath('/superadmin/users')
    revalidatePath(`/superadmin/users/${userId}`)
    return { success: true }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return { success: false, error: 'Usuario no encontrado.' }
      if (err.message === 'CANNOT_BAN_SUPERADMIN')
        return { success: false, error: 'No se puede banear a un Superadmin.' }
      if (err.message === 'ALREADY_BANNED')
        return { success: false, error: 'El usuario ya está baneado.' }
    }
    console.error('[banUser]', err)
    return { success: false, error: 'Error al banear el usuario.' }
  }
}

// ── UNBAN USER ────────────────────────────────────────────────────────────────

export async function unbanUser(userId: string): Promise<ActionResult> {
  const session = await requireSuperAdmin()

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, isBanned: true },
      })

      if (!user) throw new Error('NOT_FOUND')
      if (!user.isBanned) throw new Error('NOT_BANNED')

      await tx.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedReason: null,
        },
      })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'UNBAN_USER',
        entityType: 'User',
        entityId: userId,
        metadata: { userName: user.name },
      })
    })

    revalidatePath('/superadmin/users')
    revalidatePath(`/superadmin/users/${userId}`)
    return { success: true }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return { success: false, error: 'Usuario no encontrado.' }
      if (err.message === 'NOT_BANNED')
        return { success: false, error: 'El usuario no está baneado.' }
    }
    console.error('[unbanUser]', err)
    return { success: false, error: 'Error al levantar el ban.' }
  }
}

// ── DEACTIVATE USER ───────────────────────────────────────────────────────────

export async function deactivateUser(userId: string): Promise<ActionResult> {
  const session = await requireSuperAdmin()

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true, isActive: true },
      })

      if (!user) throw new Error('NOT_FOUND')
      if (user.role === 'SUPERADMIN') throw new Error('CANNOT_DEACTIVATE_SUPERADMIN')
      if (!user.isActive) throw new Error('ALREADY_INACTIVE')

      await tx.user.update({ where: { id: userId }, data: { isActive: false } })
      await tx.refreshToken.deleteMany({ where: { userId } })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'DEACTIVATE_USER',
        entityType: 'User',
        entityId: userId,
        metadata: { userName: user.name },
      })
    })

    revalidatePath('/superadmin/users')
    revalidatePath(`/superadmin/users/${userId}`)
    return { success: true }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return { success: false, error: 'Usuario no encontrado.' }
      if (err.message === 'CANNOT_DEACTIVATE_SUPERADMIN')
        return { success: false, error: 'No se puede desactivar a un Superadmin.' }
      if (err.message === 'ALREADY_INACTIVE')
        return { success: false, error: 'El usuario ya está inactivo.' }
    }
    console.error('[deactivateUser]', err)
    return { success: false, error: 'Error al desactivar el usuario.' }
  }
}

// ── ACTIVATE USER ─────────────────────────────────────────────────────────────

export async function activateUser(userId: string): Promise<ActionResult> {
  const session = await requireSuperAdmin()

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, isActive: true },
      })

      if (!user) throw new Error('NOT_FOUND')
      if (user.isActive) throw new Error('ALREADY_ACTIVE')

      await tx.user.update({ where: { id: userId }, data: { isActive: true } })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'ACTIVATE_USER',
        entityType: 'User',
        entityId: userId,
        metadata: { userName: user.name },
      })
    })

    revalidatePath('/superadmin/users')
    revalidatePath(`/superadmin/users/${userId}`)
    return { success: true }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return { success: false, error: 'Usuario no encontrado.' }
      if (err.message === 'ALREADY_ACTIVE')
        return { success: false, error: 'El usuario ya está activo.' }
    }
    console.error('[activateUser]', err)
    return { success: false, error: 'Error al activar el usuario.' }
  }
}

// ── CANCEL USER BOOKING ───────────────────────────────────────────────────────

export async function cancelUserBooking(bookingId: string): Promise<ActionResult> {
  const session = await requireSuperAdmin()

  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, userId: true, clubId: true, status: true, startTime: true, date: true },
      })

      if (!booking) throw new Error('NOT_FOUND')
      if (booking.status === 'CANCELLED') throw new Error('ALREADY_CANCELLED')

      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'CANCEL_BOOKING',
        entityType: 'Booking',
        entityId: bookingId,
        metadata: {
          userId: booking.userId,
          clubId: booking.clubId,
          date: booking.date.toISOString().split('T')[0],
          startTime: booking.startTime,
        },
      })
    })

    revalidatePath('/superadmin/users')
    return { success: true }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return { success: false, error: 'Reserva no encontrada.' }
      if (err.message === 'ALREADY_CANCELLED')
        return { success: false, error: 'La reserva ya fue cancelada.' }
    }
    console.error('[cancelUserBooking]', err)
    return { success: false, error: 'Error al cancelar la reserva.' }
  }
}

// ── RESET USER PASSWORD ───────────────────────────────────────────────────────

export async function resetUserPassword(userId: string): Promise<ActionResult<{ token: string }>> {
  const session = await requireSuperAdmin()

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      })

      if (!user) throw new Error('NOT_FOUND')
      if (user.role === 'SUPERADMIN') throw new Error('CANNOT_RESET_SUPERADMIN')

      const rawToken = generateRefreshTokenRaw()
      const tokenHash = hashToken(rawToken)

      // We store token hash in bannedReason field temporarily using invitation pattern
      // Actually we store it reusing the Invitation model
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

      await tx.invitation.create({
        data: {
          email: user.email,
          clubId: (await tx.club.findFirst({ select: { id: true } }))?.id ?? userId,
          invitedBy: session.userId,
          token: tokenHash,
          expiresAt,
        },
      })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'RESET_USER_PASSWORD',
        entityType: 'User',
        entityId: userId,
        metadata: { userName: user.name, email: user.email },
      })

      return { rawToken, userEmail: user.email, userName: user.name }
    })

    if (process.env.NODE_ENV !== 'production') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      console.log(`[resetUserPassword] Token: ${result.rawToken}`)
      console.log(`[resetUserPassword] URL: ${appUrl}/reset-password/${result.rawToken}`)
    }

    // Send password reset email (fire-and-forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendPasswordReset({
        to: result.userEmail,
        userName: result.userName,
        resetUrl: `${appUrl}/reset-password/${result.rawToken}`,
      })
    } catch (emailErr) {
      console.error('[resetUserPassword] Email failed:', emailErr)
    }

    revalidatePath(`/superadmin/users/${userId}`)
    return { success: true, data: { token: result.rawToken } }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return { success: false, error: 'Usuario no encontrado.' }
      if (err.message === 'CANNOT_RESET_SUPERADMIN')
        return { success: false, error: 'No se puede resetear la contraseña de un Superadmin.' }
    }
    console.error('[resetUserPassword]', err)
    return { success: false, error: 'Error al generar el reset de contraseña.' }
  }
}
