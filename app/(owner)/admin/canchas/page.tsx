import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import CanchasClient from './CanchasClient'
import { createCourt, updateCourt, toggleCourt } from '@/actions/owner/courts'

export default async function CanchasPage() {
  const session = await requireRole(['OWNER'])

  const club = await prisma.club.findFirst({
    where: { ownerId: session.userId },
    select: { id: true, name: true },
  })

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const courts = await prisma.court.findMany({
    where: { clubId: club.id },
    orderBy: { name: 'asc' },
  })

  return (
    <CanchasClient
      clubId={club.id}
      clubName={club.name}
      courts={courts}
      createCourtAction={createCourt}
      updateCourtAction={updateCourt}
      toggleCourtAction={toggleCourt}
    />
  )
}
