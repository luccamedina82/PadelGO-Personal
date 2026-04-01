import prisma from '@/lib/prisma'
import CanchasClient from './CanchasClient'
import { createCourt, updateCourt, setCourtMaintenance, getCourtPendingCount } from '@/actions/owner/courts'
import { getAdminContext } from '@/lib/dal/admin'
import { Role } from '@/app/generated/prisma/browser'

export default async function CanchasPage() {
  const { club } = await getAdminContext([Role.OWNER, Role.STAFF])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const courts = await prisma.court.findMany({
    where: { clubId: club.id },
    select: { id: true, name: true, type: true, covered: true, isActive: true, isUnderMaintenance: true },
    orderBy: { name: 'asc' },
  })

  return (
    <CanchasClient
      clubId={club.id}
      clubName={club.name}
      courts={courts}
      createCourtAction={createCourt}
      updateCourtAction={updateCourt}
      setMaintenanceAction={setCourtMaintenance}
      getCourtPendingCountAction={getCourtPendingCount}
    />
  )
}
