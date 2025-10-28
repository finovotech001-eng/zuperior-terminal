/**
 * Verify instruments and favorites setup
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifySetup() {
  console.log('🔍 Verifying setup...\n')

  // Check total instruments
  const totalInstruments = await prisma.instrument.count()
  console.log(`📊 Total Instruments: ${totalInstruments}`)

  // Check by category
  const byCategory = await prisma.instrument.groupBy({
    by: ['category'],
    _count: true,
  })
  console.log('\n📈 By Category:')
  byCategory.forEach(cat => {
    console.log(`   ${cat.category.padEnd(12)} ${cat._count}`)
  })

  // Check for specific symbols
  const checkSymbols = ['EURUSD', 'XAUUSD', 'BTCUSD', 'GBPJPY']
  console.log('\n🔎 Checking required symbols:')
  for (const symbol of checkSymbols) {
    const instrument = await prisma.instrument.findUnique({
      where: { symbol },
    })
    if (instrument) {
      console.log(`   ✅ ${symbol} - Found (${instrument.category})`)
    } else {
      console.log(`   ❌ ${symbol} - Not found`)
    }
  }

  // Check users and favorites
  const users = await prisma.user.findMany({
    include: {
      userFavorites: {
        include: {
          instrument: true,
        },
      },
    },
  })

  console.log(`\n👥 Total Users: ${users.length}`)
  console.log('\n📋 User Favorites:')
  for (const user of users) {
    console.log(`   ${user.email}:`)
    const favorites = user.userFavorites.sort((a, b) => a.sortOrder - b.sortOrder)
    if (favorites.length > 0) {
      favorites.forEach(fav => {
        console.log(`      - ${fav.instrument.symbol} (order: ${fav.sortOrder})`)
      })
    } else {
      console.log(`      No favorites`)
    }
  }

  await prisma.$disconnect()
}

verifySetup()

