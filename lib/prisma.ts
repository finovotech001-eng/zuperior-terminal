import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Singleton pattern for Prisma Client
export const prisma = global.prisma ?? new PrismaClient({
  log: ['error'], // Only log errors, no query logs
})

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Graceful shutdown
async function disconnectPrisma() {
  await prisma.$disconnect()
}

// Handle process termination
process.on('SIGINT', disconnectPrisma)
process.on('SIGTERM', disconnectPrisma)
process.on('beforeExit', disconnectPrisma)

export default prisma

