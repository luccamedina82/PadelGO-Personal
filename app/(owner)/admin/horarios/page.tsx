import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import HorariosClient from './HorariosClient'
import { updateClubAvailability } from '@/actions/owner/availability'

export default async function HorariosPage() {
  const session = await requireRole(['OWNER', 'STAFF'])

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

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const courts = await prisma.court.findMany({
    where: { clubId: club.id, isActive: true },
    include: {
      availabilities: {
        orderBy: { dayOfWeek: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <HorariosClient
      clubId={club.id}
      clubName={club.name}
      courts={courts}
      updateClubAvailabilityAction={updateClubAvailability}
    />
  )
}
