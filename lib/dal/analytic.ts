import { cache } from 'react'
import prisma from '@/lib/prisma'

// Fíjate que esta función no hace .map() ni transforma fechas.
// Devuelve la data pura de Prisma (donde date YA ES un objeto Date).
export const getFinancialBookings = cache(async (clubId: string, startDate: Date, endDate: Date) => {
  return prisma.booking.findMany({
    where: {
      clubId,
      date: { gte: startDate, lte: endDate },
      status: { not: 'CANCELLED' } 
    },
    select: {
      date: true, 
      startTime: true, 
      durationMinutes: true, 
      totalPrice: true, 
      status: true, 
      source: true, 
      courtId: true,
    },
  })
})



export const getTrendBookings = cache(async (clubId: string, startDate: Date, endDate: Date) => {
  return prisma.booking.findMany({
    where: {
      clubId,
      date: { gte: startDate, lt: endDate }, // lt en lugar de lte, para excluir el "hoy" como tenías en tu código
      status: { not: 'CANCELLED' },
    },
    select: { 
      date: true // ¡Perfecto! Solo pedimos la fecha para contar. Prisma vuela con esto.
    },
  })
})