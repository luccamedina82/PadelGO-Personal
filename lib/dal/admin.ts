import { requireRole } from '@/actions/auth'
import prisma from '../prisma'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { Role } from '@/types'

export const getAdminContext = cache(async (roles: Role[]) => {
  const session = await requireRole(roles)

  if (!session) {
    redirect('/login')
  }
  const club =
    session.role === 'STAFF'
      ? await prisma.club.findUnique({
          where: { id: session.staffClubId ?? '' },
          select: { id: true, name: true },
        })
      : await prisma.club.findFirst({
          where: { ownerId: session.userId },
          select: { id: true, name: true },
        })
  return {
    session,
    club,
    hasClub: !!club,
  }
}
)
