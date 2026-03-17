import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import ConfigClient from './ConfigClient'
import { updateClubConfig } from '@/actions/owner/config'
import { createSpecialHours, deleteSpecialHours } from '@/actions/owner/special-hours'

export default async function ConfigPage() {
  const session = await requireRole(['OWNER'])

  const club = await prisma.club.findFirst({
    where: { ownerId: session.userId },
    include: {
      specialHours: {
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  return (
    <ConfigClient
      club={{
        id: club.id,
        name: club.name,
        description: club.description,
        vibe: club.vibe,
        address: club.address,
        phone: club.phone,
        email: club.email,
        amenities: club.amenities,
        tags: club.tags,
        cancelHoursBeforeStart: club.cancelHoursBeforeStart,
        cancellationFeePercent: club.cancellationFeePercent,
        allowedDurations: club.allowedDurations,
        specialHours: club.specialHours.map((sh) => ({
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
