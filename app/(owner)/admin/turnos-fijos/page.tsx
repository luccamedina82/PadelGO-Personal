import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import TurnosFijosClient from './TurnosFijosClient'
import {
  createRecurringBooking,
  cancelRecurringBooking,
  listRecurringBookings,
} from '@/actions/owner/recurring'

export default async function TurnosFijosPage() {
  const session = await requireRole(['OWNER', 'STAFF'])

  // Resolve club for this session
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { staffClubId: true, ownedClubs: { select: { id: true } } },
  })

  const clubId =
    session.role === 'STAFF' ? (user?.staffClubId ?? '') : (user?.ownedClubs[0]?.id ?? '')

  const [courts, recurring] = await Promise.all([
    prisma.court.findMany({
      where: { clubId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    listRecurringBookings(clubId),
  ])

  return (
    <TurnosFijosClient
      clubId={clubId}
      courts={courts}
      recurring={recurring}
      createAction={createRecurringBooking}
      cancelAction={cancelRecurringBooking}
    />
  )
}
