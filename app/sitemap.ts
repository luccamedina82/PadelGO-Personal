import type { MetadataRoute } from 'next'
import prisma from '@/lib/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://padelgo.ar'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clubs = await prisma.club.findMany({
    where: { isActive: true },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const clubUrls: MetadataRoute.Sitemap = clubs.map((club) => ({
    url: `${APP_URL}/club/${club.id}`,
    lastModified: club.updatedAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${APP_URL}/buscar`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${APP_URL}/open-match`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    ...clubUrls,
  ]
}
