import prisma from '@/lib/prisma'
import { cacheTag } from 'next/cache'
import { cacheLife } from 'next/cache'

export async function getCourtsByClubId(clubId: string) {
  'use cache'
  cacheLife('days')
  cacheTag(`courts-${clubId}`) // Cachea esta función por clubId, para que al invalidar la etiqueta se actualicen los datos de ese club específico

  const courts = await prisma.court.findMany({
    where: { clubId: clubId, isActive: true },
    select: {
      id: true,
      name: true,
      availabilities: {
        where: { isActive: true },
        select: { dayOfWeek: true, openTime: true, closeTime: true, isActive: true,},
      },
    },
    orderBy: { name: 'asc' },
  })


  return courts
}
