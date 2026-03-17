import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg' // <-- Agrega esta importación

// Singleton pattern — prevents multiple instances during Next.js hot-reload in dev
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // 1. Instanciamos el Pool de conexiones de 'pg'
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL! 
  })

  // 2. Le pasamos el pool al adaptador de Prisma
  // @ts-expect-error: Prisma espera tipos de pg 8.11 pero usamos 8.18
    const adapter = new PrismaPg(pool)
    
  // 3. Inicializamos el cliente
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma