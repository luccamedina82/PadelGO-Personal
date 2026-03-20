import prisma from '@/lib/prisma'
import { argToday } from '@/lib/date'
import EquipoClient from './EquipoClient'
import { inviteStaff, removeStaff } from '@/actions/owner/staff'
import { getAdminContext } from '@/lib/dal/admin'
import { Role } from '@/app/generated/prisma/browser'

export default async function EquipoPage() {
  const { club } = await getAdminContext([Role.OWNER])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const [staffMembers, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { staffClubId: club.id, role: 'STAFF' },
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { clubId: club.id, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const now = argToday()
  const invitationsForClient = invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    isExpired: inv.expiresAt < now,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }))

  return (
    <EquipoClient
      clubId={club.id}
      clubName={club.name}
      staffMembers={staffMembers.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      invitations={invitationsForClient}
      inviteStaffAction={inviteStaff}
      removeStaffAction={removeStaff}
    />
  )
}
