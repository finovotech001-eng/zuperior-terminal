import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function searchSymbols() {
  console.log('🔍 Searching for specific symbols...\n')
  
  const searches = ['EUR', 'GBP', 'XAU', 'GOLD']
  
  for (const term of searches) {
    const symbols = await prisma.instrument.findMany({
      where: {
        symbol: { contains: term, mode: 'insensitive' }
      },
      take: 10,
      orderBy: { symbol: 'asc' }
    })
    
    console.log(`\n🔎 Symbols containing "${term}":`)
    if (symbols.length === 0) {
      console.log('   ❌ None found')
    } else {
      symbols.forEach(s => console.log(`   ✅ ${s.symbol} - ${s.description}`))
    }
  }
  
  await prisma.$disconnect()
}

searchSymbols()

