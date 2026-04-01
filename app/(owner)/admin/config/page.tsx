import prisma from '@/lib/prisma'
import ConfigClient from './ConfigClient'
import { updateClubConfig } from '@/actions/owner/config'
import { createSpecialHours, deleteSpecialHours } from '@/actions/owner/special-hours'
import { getAdminContext } from '@/lib/dal/admin'
import { Role } from '@/app/generated/prisma/enums'

export default async function ConfigPage() {
  const { session } = await getAdminContext([Role.OWNER])

  const selectedClub = await prisma.club.findFirst({
    where: { ownerId: session.userId },
    include: {
      specialHours: {
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!selectedClub) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  return (
    <ConfigClient
      club={{
        id: selectedClub.id,
        name: selectedClub.name,
        description: selectedClub.description,
        vibe: selectedClub.vibe,
        address: selectedClub.address,
        phone: selectedClub.phone,
        email: selectedClub.email,
        amenities: selectedClub.amenities,
        tags: selectedClub.tags,
        cancelHoursBeforeStart: selectedClub.cancelHoursBeforeStart,
        cancellationFeePercent: selectedClub.cancellationFeePercent,
        specialHours: selectedClub.specialHours.map((sh) => ({
          id: sh.id,
          date: sh.date.toISOString().split('T')[0], // ISO date format
          reason: sh.reason,
          isClosed: sh.isClosed,
          openTime: sh.openTime || undefined,
          closeTime: sh.closeTime || undefined,
        })),
      }}
      updateClubConfigAction={updateClubConfig}
      createSpecialHoursAction={createSpecialHours}
      deleteSpecialHoursAction={deleteSpecialHours}
    />
  )
}
