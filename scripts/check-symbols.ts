import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSymbols() {
  console.log('🔍 Checking available symbols...\n')
  
  // Check forex symbols
  const forexSymbols = await prisma.instrument.findMany({
    where: {
      OR: [
        { symbol: { contains: 'EUR', mode: 'insensitive' } },
        { symbol: { contains: 'GBP', mode: 'insensitive' } },
        { symbol: { contains: 'USD', mode: 'insensitive' } },
        { symbol: { contains: 'XAU', mode: 'insensitive' } },
        { symbol: { contains: 'GOLD', mode: 'insensitive' } },
      ]
    },
    take: 20,
    orderBy: { symbol: 'asc' }
  })
  
  console.log('💱 Forex/Metal symbols found:')
  forexSymbols.forEach(s => console.log(`   ${s.symbol} - ${s.description}`))
  
  // Check crypto
  const cryptoSymbols = await prisma.instrument.findMany({
    where: {
      OR: [
        { symbol: { contains: 'BTC', mode: 'insensitive' } },
        { symbol: { contains: 'ETH', mode: 'insensitive' } },
      ]
    },
    take: 10,
    orderBy: { symbol: 'asc' }
  })
  
  console.log('\n🪙 Crypto symbols found:')
  cryptoSymbols.forEach(s => console.log(`   ${s.symbol} - ${s.description}`))
  
  await prisma.$disconnect()
}

checkSymbols()




