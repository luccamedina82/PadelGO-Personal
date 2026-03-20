import prisma from '@/lib/prisma'
import TurnosFijosClient from './TurnosFijosClient'
import {
  createRecurringBooking,
  cancelRecurringBooking,
  listRecurringBookings,
} from '@/actions/owner/recurring'
import { Role } from '@/app/generated/prisma/browser'
import { getAdminContext } from '@/lib/dal/admin'

export default async function TurnosFijosPage() {
    const { club } = await getAdminContext([Role.OWNER, Role.STAFF])
  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const [courts, recurring] = await Promise.all([
    prisma.court.findMany({
      where: { clubId: club.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    listRecurringBookings(club.id),
  ])

  return (
    <TurnosFijosClient
      clubId={club.id}
      courts={courts}
      recurring={recurring}
      createAction={createRecurringBooking}
      cancelAction={cancelRecurringBooking}
    />
  )
}
