import prisma from "@/lib/prisma"
import { cacheLife, cacheTag } from "next/cache"



export const getCourtsByClub = async (clubId: string) => {
    'use cache'
    cacheTag(`courts-${clubId}`)
    cacheLife('minutes')

    console.log('Consultando Prisma para el club: ', clubId)

    return prisma.court.findMany({
        where: { clubId, isActive: true },
    })
}