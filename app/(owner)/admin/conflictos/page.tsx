import { getAdminContext } from '@/lib/dal/admin'
import { getConflictBookings, getRecentCancellations } from '@/features/reservas/dal/conflicts'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import ConflictosClient from './ConflictosClient'

export default async function ConflictosPage() {
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const [conflicts, cancellations, { courts: allCourts }] = await Promise.all([
    getConflictBookings(club.id),
    getRecentCancellations(club.id),
    getCourtsByClubId(club.id),
  ])

  // Exclude courts under maintenance — they can't receive relocated bookings
  const courts = allCourts
    .filter((c) => !c.isUnderMaintenance)
    .map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-[20px] tracking-[2.5px] text-text uppercase">
          Centro de Resolución
        </h1>
        <p className="text-[12px] text-muted mt-1">
          Gestioná conflictos y cancelaciones del club
        </p>
      </div>
      <ConflictosClient conflicts={conflicts} cancellations={cancellations} courts={courts} />
    </div>
  )
}
