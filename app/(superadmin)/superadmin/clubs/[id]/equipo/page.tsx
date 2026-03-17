import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import SuperadminBanner from '@/components/layout/SuperadminBanner'
import EquipoClient from '@/app/(owner)/admin/equipo/EquipoClient'
import { inviteStaff, removeStaff } from '@/actions/owner/staff'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SuperadminClubEquipoPage({ params }: Props) {
  await requireSuperAdmin()

  const { id } = await params

  const club = await prisma.club.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      zone: true,
      isActive: true,
      _count: { select: { courts: true } },
    },
  })

  if (!club) notFound()

  const now = new Date()

  const [staffMembers, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { staffClubId: id, role: 'STAFF' },
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
      where: { clubId: id, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const invitationsForClient = invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    isExpired: inv.expiresAt < now,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }))

  return (
    <div className="min-h-screen" style={{ background: '#0a0810' }}>
      <SuperadminBanner
        clubId={id}
        clubName={club.name}
        zone={club.zone}
        courtCount={club._count.courts}
        isActive={club.isActive}
      />
      <EquipoClient
        clubId={id}
        clubName={club.name}
        staffMembers={staffMembers.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        invitations={invitationsForClient}
        inviteStaffAction={inviteStaff}
        removeStaffAction={removeStaff}
      />
    </div>
  )
}
