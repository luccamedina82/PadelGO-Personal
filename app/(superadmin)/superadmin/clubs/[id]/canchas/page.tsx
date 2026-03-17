import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import SuperadminBanner from '@/components/layout/SuperadminBanner'
import CanchasClient from '@/app/(owner)/admin/canchas/CanchasClient'
import { createCourt, updateCourt, toggleCourt } from '@/actions/owner/courts'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SuperadminClubCanchasPage({ params }: Props) {
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

  const courts = await prisma.court.findMany({
    where: { clubId: id },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="min-h-screen" style={{ background: '#0a0810' }}>
      <SuperadminBanner
        clubId={id}
        clubName={club.name}
        zone={club.zone}
        courtCount={club._count.courts}
        isActive={club.isActive}
      />
      <CanchasClient
        clubId={id}
        clubName={club.name}
        courts={courts}
        createCourtAction={createCourt}
        updateCourtAction={updateCourt}
        toggleCourtAction={toggleCourt}
      />
    </div>
  )
}
