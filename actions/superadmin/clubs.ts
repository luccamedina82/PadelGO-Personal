'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireSuperAdmin } from '@/actions/auth'
import { createAuditLog } from '@/lib/audit'
import { generateRefreshTokenRaw, hashToken } from '@/lib/auth'
import { sendOwnerWelcome } from '@/lib/email'
import type { ActionResult } from '@/types'

// ── CREATE CLUB ───────────────────────────────────────────────────────────────

export interface CreateClubInput {
  name: string
  zone: string
  address: string
  city: string
  lat: number
  lng: number
  phone: string
  email: string
  ownerEmail: string
  ownerName?: string
}

export async function createClub(
  input: CreateClubInput
): Promise<ActionResult<{ clubId: string; ownerInvited: boolean }>> {
  const session = await requireSuperAdmin()

  const { name, zone, address, city, lat, lng, phone, email, ownerEmail, ownerName } = input

  if (!name?.trim()) return { success: false, error: 'El nombre del club es obligatorio.' }
  if (!zone?.trim()) return { success: false, error: 'La zona es obligatoria.' }
  if (!address?.trim()) return { success: false, error: 'La dirección es obligatoria.' }
  if (!ownerEmail?.trim() || !ownerEmail.includes('@')) {
    return { success: false, error: 'Email del owner inválido.' }
  }

  try {
    let ownerInvited = false
    let ownerRawToken: string | null = null

    const result = await prisma.$transaction(async (tx) => {
      // Find or create owner
      let owner = await tx.user.findUnique({
        where: { email: ownerEmail.toLowerCase() },
        select: { id: true, role: true },
      })

      let ownerId: string

      if (owner) {
        ownerId = owner.id
      } else {
        // Create placeholder owner (they'll activate via invitation)
        const newOwner = await tx.user.create({
          data: {
            email: ownerEmail.toLowerCase(),
            name: ownerName?.trim() ?? ownerEmail.split('@')[0] ?? 'Owner',
            password: '',
            zone: zone,
            avatarColor: '#a855f7',
            role: 'OWNER',
            isActive: false,
          },
          select: { id: true },
        })
        ownerId = newOwner.id
        ownerInvited = true
      }

      const club = await tx.club.create({
        data: {
          name: name.trim(),
          description: '',
          vibe: '',
          city: city?.trim() || 'Buenos Aires',
          zone: zone.trim(),
          address: address.trim(),
          lat: lat || 0,
          lng: lng || 0,
          phone: phone?.trim() || '',
          email: email?.trim() || ownerEmail.toLowerCase(),
          amenities: [],
          tags: [],
          colorR: 168,
          colorG: 85,
          colorB: 247,
          photos: [],
          isActive: false,
          ownerId,
        },
        select: { id: true },
      })

      // If owner is new, create an invitation
      if (ownerInvited) {
        const rawToken = generateRefreshTokenRaw()
        ownerRawToken = rawToken // capture for email after TX
        const tokenHash = hashToken(rawToken)
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

        await tx.invitation.create({
          data: {
            email: ownerEmail.toLowerCase(),
            clubId: club.id,
            invitedBy: session.userId,
            token: tokenHash,
            expiresAt,
          },
        })

        if (process.env.NODE_ENV !== 'production') {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
          console.log(`[createClub] Owner invitation token for ${ownerEmail}: ${rawToken}`)
          console.log(`[createClub] URL: ${appUrl}/invitacion/${rawToken}`)
        }
      }

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'CREATE_CLUB',
        entityType: 'Club',
        entityId: club.id,
        metadata: { clubName: name.trim(), ownerEmail, ownerInvited },
      })

      return { clubId: club.id }
    })

    revalidatePath('/superadmin/clubs')
    revalidatePath('/superadmin')

    // Send owner welcome email if a new owner was created (fire-and-forget)
    if (ownerInvited && ownerRawToken) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      try {
        await sendOwnerWelcome({
          to: ownerEmail.toLowerCase(),
          ownerName: ownerName?.trim() ?? ownerEmail.split('@')[0] ?? 'Owner',
          clubName: name.trim(),
          invitationUrl: `${appUrl}/invitacion/${ownerRawToken}`,
        })
      } catch (emailErr) {
        console.error('[createClub] Owner welcome email failed:', emailErr)
      }
    }

    return { success: true, data: { clubId: result.clubId, ownerInvited } }
  } catch (err) {
    console.error('[createClub]', err)
    return { success: false, error: 'Error al crear el club.' }
  }
}

// ── TOGGLE CLUB ACTIVE ────────────────────────────────────────────────────────

export async function toggleClubActive(
  clubId: string
): Promise<ActionResult<{ isActive: boolean }>> {
  const session = await requireSuperAdmin()

  try {
    const result = await prisma.$transaction(async (tx) => {
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { id: true, name: true, isActive: true },
      })

      if (!club) throw new Error('NOT_FOUND')

      const newActive = !club.isActive

      await tx.club.update({
        where: { id: clubId },
        data: { isActive: newActive },
      })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: newActive ? 'ACTIVATE_CLUB' : 'DEACTIVATE_CLUB',
        entityType: 'Club',
        entityId: clubId,
        metadata: { clubName: club.name, newActive },
      })

      return { isActive: newActive }
    })

    revalidatePath('/superadmin/clubs')
    revalidatePath(`/superadmin/clubs/${clubId}`)
    revalidatePath('/superadmin')
    return { success: true, data: result }
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return { success: false, error: 'Club no encontrado.' }
    }
    console.error('[toggleClubActive]', err)
    return { success: false, error: 'Error al cambiar el estado del club.' }
  }
}

// ── UPDATE CLUB ───────────────────────────────────────────────────────────────

export interface UpdateClubInput {
  clubId: string
  name?: string
  description?: string
  vibe?: string
  zone?: string
  address?: string
  phone?: string
  email?: string
  amenities?: string[]
  tags?: string[]
}

export async function updateClub(input: UpdateClubInput): Promise<ActionResult> {
  const session = await requireSuperAdmin()

  const { clubId, ...fields } = input

  try {
    await prisma.$transaction(async (tx) => {
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { id: true, name: true },
      })

      if (!club) throw new Error('NOT_FOUND')

      await tx.club.update({
        where: { id: clubId },
        data: {
          ...(fields.name !== undefined && { name: fields.name.trim() }),
          ...(fields.description !== undefined && { description: fields.description }),
          ...(fields.vibe !== undefined && { vibe: fields.vibe }),
          ...(fields.zone !== undefined && { zone: fields.zone.trim() }),
          ...(fields.address !== undefined && { address: fields.address.trim() }),
          ...(fields.phone !== undefined && { phone: fields.phone.trim() }),
          ...(fields.email !== undefined && { email: fields.email.trim() }),
          ...(fields.amenities !== undefined && { amenities: fields.amenities }),
          ...(fields.tags !== undefined && { tags: fields.tags }),
        },
      })

      await createAuditLog(tx, {
        actorId: session.userId,
        action: 'UPDATE_CLUB',
        entityType: 'Club',
        entityId: clubId,
        metadata: { clubName: club.name, fields: Object.keys(fields) },
      })
    })

    revalidatePath('/superadmin/clubs')
    revalidatePath(`/superadmin/clubs/${clubId}`)
    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return { success: false, error: 'Club no encontrado.' }
    }
    console.error('[updateClub]', err)
    return { success: false, error: 'Error al actualizar el club.' }
  }
}
