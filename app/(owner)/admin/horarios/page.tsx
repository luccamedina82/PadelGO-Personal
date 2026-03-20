import prisma from '@/lib/prisma'
import HorariosClient from './HorariosClient'
import { updateClubAvailability } from '@/actions/owner/availability'
import { getAdminContext } from '@/lib/dal/admin'
import { Role } from '@/app/generated/prisma/enums'

export default async function HorariosPage() {
  const { club } = await getAdminContext([Role.OWNER, Role.STAFF])

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
