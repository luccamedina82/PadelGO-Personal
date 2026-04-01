import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClub } from '@/lib/dal/pruebas'
import { Suspense } from 'react'
import { CourtType } from '@/app/generated/prisma/browser'




export default async function PruebasCache() {
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }


  return (
    <div>
    </div>
  )
}

