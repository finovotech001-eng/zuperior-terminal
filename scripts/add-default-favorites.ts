/**
 * Script to add default favorites to all existing users
 * Run this once after syncing instruments
 */

import { prisma } from '../lib/prisma'

// Default favorite pairs that will be added to all users
const DEFAULT_FAVORITES = [
  'EURUSD',
  'XAUUSD',
  'BTCUSD',
  'GBPJPY',
]

/**
 * Add default favorites to a user
 */
async function addDefaultFavoritesToUser(userId: string) {
  let added = 0
  let skipped = 0

  for (let i = 0; i < DEFAULT_FAVORITES.length; i++) {
    const symbol = DEFAULT_FAVORITES[i]
    
    try {
      // Find instrument by symbol (case-insensitive)
      const instrument = await prisma.instrument.findFirst({
        where: {
          symbol: {
            equals: symbol,
            mode: 'insensitive',
          },
        },
      })

      if (!instrument) {
        console.log(`   ⚠️  Instrument not found: ${symbol}`)
        skipped++
        continue
      }

      // Check if already favorited
      const existing = await prisma.userFavorite.findUnique({
        where: {
          userId_instrumentId: {
            userId,
            instrumentId: instrument.id,
          },
        },
      })

      if (existing) {
        skipped++
        continue
      }

      // Add to favorites
      await prisma.userFavorite.create({
        data: {
          userId,
          instrumentId: instrument.id,
          sortOrder: i, // Use index as sort order
        },
      })

      added++
    } catch (error) {
      console.error(`   ❌ Error adding ${symbol}:`, error)
      skipped++
    }
  }

  return { added, skipped }
}

/**
 * Main function
 */
async function addDefaultFavorites() {
  console.log('🚀 Adding default favorites to all users...\n')

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (users.length === 0) {
      console.log('⚠️  No users found in database')
      return
    }

    console.log(`📊 Found ${users.length} users\n`)

    let totalAdded = 0
    let totalSkipped = 0

    // Process each user
    for (const user of users) {
      process.stdout.write(`Processing: ${user.email}...`)
      
      const { added, skipped } = await addDefaultFavoritesToUser(user.id)
      
      totalAdded += added
      totalSkipped += skipped

      console.log(` ✅ Added: ${added}, Skipped: ${skipped}`)
    }

    console.log('\n📈 Summary:')
    console.log(`   Total users processed: ${users.length}`)
    console.log(`   Total favorites added: ${totalAdded}`)
    console.log(`   Total skipped: ${totalSkipped}`)
    console.log('\n🎉 Default favorites added successfully!\n')
  } catch (error) {
    console.error('\n❌ Failed to add default favorites:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
addDefaultFavorites()

