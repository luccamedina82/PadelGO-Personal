'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireRole } from '@/actions/auth'
import { generateRefreshTokenRaw, hashToken, hashPassword, verifyPassword } from '@/lib/auth'
import { sendStaffInvitation } from '@/lib/email'
import type { ActionResult } from '@/types'

export async function inviteStaff(
  email: string,
  clubId: string
): Promise<ActionResult<{ invitationId: string }>> {
  const session = await requireRole(['OWNER'])

  if (!email?.trim() || !email.includes('@')) {
    return { success: false, error: 'Email inválido.' }
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, role: true, staffClubId: true },
    })
    if (existing && existing.role === 'STAFF' && existing.staffClubId === clubId) {
      return { success: false, error: 'Este usuario ya es staff de tu club.' }
    }

    await prisma.invitation.deleteMany({
      where: { email: email.toLowerCase(), clubId },
    })

    const rawToken = generateRefreshTokenRaw()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        clubId,
        invitedBy: session.userId,
        token: tokenHash,
        expiresAt,
      },
      select: { id: true },
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[inviteStaff] Token for ${email}: ${rawToken}`)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      console.log(`[inviteStaff] URL: ${appUrl}/invitacion/${rawToken}`)
    }

    // Send invitation email (fire-and-forget — email failures don't block the action)
    try {
      const [club, inviter] = await Promise.all([
        prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
      ])
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendStaffInvitation({
        to: email.toLowerCase(),
        clubName: club?.name ?? 'el club',
        inviterName: inviter?.name ?? 'el dueño',
        invitationUrl: `${appUrl}/invitacion/${rawToken}`,
      })
    } catch (emailErr) {
      console.error('[inviteStaff] Email failed:', emailErr)
    }

    revalidatePath('/admin/equipo')
    return { success: true, data: { invitationId: invitation.id } }
  } catch (err) {
    console.error('[inviteStaff]', err)
    return { success: false, error: 'Error al enviar la invitación.' }
  }
}

export async function removeStaff(staffUserId: string, clubId: string): Promise<ActionResult> {
  await requireRole(['OWNER'])

  try {
    const user = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { role: true, staffClubId: true },
    })
    if (!user || user.role !== 'STAFF' || user.staffClubId !== clubId) {
      return { success: false, error: 'Usuario no encontrado en este club.' }
    }

    await prisma.user.update({
      where: { id: staffUserId },
      data: { staffClubId: null },
    })

    await prisma.refreshToken.deleteMany({ where: { userId: staffUserId } })

    revalidatePath('/admin/equipo')
    return { success: true }
  } catch (err) {
    console.error('[removeStaff]', err)
    return { success: false, error: 'Error al remover el staff.' }
  }
}

export async function acceptStaffInvitation(input: {
  token: string
  /** CASO B only — new user name */
  name?: string
  /** CASO A: existing account password to verify; CASO B: new password */
  password: string
}): Promise<ActionResult<{ redirectTo: string }>> {
  const { token: rawToken, name, password } = input

  if (!password) return { success: false, error: 'La contraseña es obligatoria.' }

  const tokenHash = hashToken(rawToken)

  try {
    await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { token: tokenHash },
        select: { id: true, email: true, clubId: true, acceptedAt: true, expiresAt: true },
      })

      if (!invitation) throw new Error('TOKEN_INVALID')
      if (invitation.acceptedAt) throw new Error('TOKEN_USED')
      if (invitation.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED')

      const existingUser = await tx.user.findUnique({
        where: { email: invitation.email },
        select: { id: true, password: true },
      })

      if (existingUser) {
        // CASO A — existing account: verify current password, never overwrite it
        const passwordOk = await verifyPassword(password, existingUser.password)
        if (!passwordOk) throw new Error('WRONG_PASSWORD')

        await tx.user.update({
          where: { id: existingUser.id },
          data: { role: 'STAFF', staffClubId: invitation.clubId },
        })
      } else {
        // CASO B — new account: require name + create user
        if (!name?.trim()) throw new Error('NAME_REQUIRED')
        if (password.length < 6) throw new Error('PASSWORD_TOO_SHORT')

        const passwordHash = await hashPassword(password)

        await tx.user.create({
          data: {
            email: invitation.email,
            name: name.trim(),
            password: passwordHash,
            role: 'STAFF',
            staffClubId: invitation.clubId,
            zone: '',
            avatarColor: '#84cc16',
          },
        })
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      })
    })

    return { success: true, data: { redirectTo: '/login?activated=true' } }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'TOKEN_INVALID') return { success: false, error: 'Invitación inválida.' }
      if (err.message === 'TOKEN_USED') return { success: false, error: 'Esta invitación ya fue usada.' }
      if (err.message === 'TOKEN_EXPIRED') return { success: false, error: 'Esta invitación expiró.' }
      if (err.message === 'WRONG_PASSWORD') return { success: false, error: 'Contraseña incorrecta.' }
      if (err.message === 'NAME_REQUIRED') return { success: false, error: 'El nombre es obligatorio.' }
      if (err.message === 'PASSWORD_TOO_SHORT') return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
    }
    console.error('[acceptStaffInvitation]', err)
    return { success: false, error: 'Error al activar la cuenta.' }
  }
}
