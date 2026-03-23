import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClub } from '@/lib/dal/pruebas'
import { Suspense } from 'react'
import { CourtsList } from './CourtsList'
import { CourtType } from '@/app/generated/prisma/browser'

interface InterfaceInitialData {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    clubId: string;
    type: CourtType;
    covered: boolean;
    svgX: number;
    svgY: number;
    svgW: number;
    svgH: number;
}


export default async function PruebasCache() {
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const initialData: InterfaceInitialData[] = await getCourtsByClub(club.id)

  return (
    <div>
      <h1>Pruebas de Cache</h1>
      <Suspense fallback={<div>Cargando canchas...</div>}>
        <CourtsList clubId={club.id} initialData={initialData} />
      </Suspense>
    </div>
  )
}

