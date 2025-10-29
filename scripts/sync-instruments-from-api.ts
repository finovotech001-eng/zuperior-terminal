/**
 * Sync instruments from API and set default favorites for all users
 * Usage: npx tsx scripts/sync-instruments-from-api.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// API Configuration
const API_URL = 'http://18.130.5.209:5003/api/Symbols'

// Default favorites to add to all users
const DEFAULT_FAVORITES = ['EURUSD', 'XAUUSD', 'BTCUSD', 'GBPJPY']

interface ApiSymbol {
  Symbol: string
  Description?: string
  Path?: string
  Digits?: number
  ContractSize?: number
  VolumeMin?: number
  VolumeMax?: number
  VolumeStep?: number
  Spread?: number
  TradeMode?: number
  [key: string]: any
}

/**
 * Determine category based on symbol and path
 */
function determineCategory(symbol: string, path?: string): string {
  const lowerSymbol = symbol.toLowerCase()
  const lowerPath = path?.toLowerCase() || ''
  
  // Check path first for better accuracy
  if (lowerPath.includes('crypto')) return 'crypto'
  if (lowerPath.includes('metal')) return 'commodities'
  if (lowerPath.includes('indices') || lowerPath.includes('index')) return 'indices'
  if (lowerPath.includes('forex')) return 'forex'
  if (lowerPath.includes('shares') || lowerPath.includes('stocks')) return 'stocks'
  
  // Fallback to symbol-based detection
  if (lowerSymbol.includes('/') && lowerSymbol.length <= 7) return 'forex'
  if (lowerSymbol.includes('usd') && lowerSymbol.length > 3 && lowerSymbol.length <= 10) return 'crypto'
  if (lowerSymbol.startsWith('us') && lowerSymbol.length > 3) return 'indices'
  if (lowerSymbol.startsWith('x')) return 'commodities'
  
  return 'stocks'
}

/**
 * Fetch instruments from API
 */
async function fetchInstruments(): Promise<ApiSymbol[]> {
  console.log('🚀 Starting instrument sync...\n')
  console.log(`📡 Fetching from: ${API_URL}`)
  
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      throw new Error('API response is not an array')
    }

    console.log(`✅ Fetched ${data.length} instruments from API\n`)
    return data
  } catch (error) {
    console.error('❌ Failed to fetch instruments:', error)
    throw error
  }
}

/**
 * Sync instruments to database
 */
async function syncInstrumentsToDatabase(instruments: ApiSymbol[]) {
  console.log('💾 Syncing instruments to database...\n')
  
  let created = 0
  let updated = 0
  let errors = 0

  for (let i = 0; i < instruments.length; i++) {
    const item = instruments[i]
    const symbol = item.Symbol
    
    if (!symbol) {
      errors++
      continue
    }

    try {
      const category = determineCategory(symbol, item.Path)
      const group = item.Path || category

      const result = await prisma.instrument.upsert({
        where: { symbol },
        update: {
          name: item.Description || symbol,
          description: item.Description || symbol,
          category,
          group,
          digits: item.Digits || 5,
          contractSize: item.ContractSize || 100000,
          minVolume: item.VolumeMin || 0.01,
          maxVolume: item.VolumeMax || 100,
          volumeStep: item.VolumeStep || 0.01,
          spread: Number(item.Spread || 0),
          isActive: true,
          tradingHours: null,
          lastUpdated: new Date(),
        },
        create: {
          symbol,
          name: item.Description || symbol,
          description: item.Description || symbol,
          category,
          group,
          digits: item.Digits || 5,
          contractSize: item.ContractSize || 100000,
          minVolume: item.VolumeMin || 0.01,
          maxVolume: item.VolumeMax || 100,
          volumeStep: item.VolumeStep || 0.01,
          spread: Number(item.Spread || 0),
          isActive: true,
          tradingHours: null,
        },
      })

      const timeDiff = result.lastUpdated.getTime() - result.createdAt.getTime()
      if (timeDiff < 1000) {
        created++
      } else {
        updated++
      }

      // Progress indicator
      if ((created + updated + errors) % 50 === 0) {
        process.stdout.write(`   Progress: ${created + updated + errors}/${instruments.length}\r`)
      }
    } catch (error) {
      console.error(`\n   ❌ Error processing ${symbol}:`, error)
      errors++
    }
  }

  console.log(`\n\n✅ Sync completed!`)
  console.log(`┌─────────────────────────────────┐`)
  console.log(`│   ✨ Created:  ${created.toString().padStart(4)}           │`)
  console.log(`│   🔄 Updated:  ${updated.toString().padStart(4)}           │`)
  console.log(`│   ❌ Errors:   ${errors.toString().padStart(4)}           │`)
  console.log(`│   📊 Total:    ${instruments.length.toString().padStart(4)}           │`)
  console.log(`└─────────────────────────────────┘\n`)

  // Show breakdown by category
  const byCategory = await prisma.instrument.groupBy({
    by: ['category'],
    _count: true,
  })

  console.log('📈 Breakdown by category:')
  byCategory.forEach(cat => {
    console.log(`   ${cat.category.padEnd(12)} ${cat._count}`)
  })
}

/**
 * Add default favorites to all users
 */
async function addDefaultFavoritesToAllUsers() {
  console.log('\n🚀 Adding default favorites to all users...\n')

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
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
    let userAdded = 0
    let userSkipped = 0

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
          userSkipped++
          continue
        }

        // Check if already favorited
        const existing = await prisma.userFavorite.findUnique({
          where: {
            userId_instrumentId: {
              userId: user.id,
              instrumentId: instrument.id,
            },
          },
        })

        if (existing) {
          userSkipped++
          continue
        }

        // Add to favorites
        await prisma.userFavorite.create({
          data: {
            userId: user.id,
            instrumentId: instrument.id,
            sortOrder: i,
          },
        })

        userAdded++
      } catch (error) {
        console.error(`   ❌ Error adding ${symbol}:`, error)
        userSkipped++
      }
    }

    totalAdded += userAdded
    totalSkipped += userSkipped

    console.log(`   ✅ ${user.email}: Added ${userAdded}, Skipped ${userSkipped}`)
  }

  console.log('\n📈 Summary:')
  console.log(`   Total users: ${users.length}`)
  console.log(`   Total favorites added: ${totalAdded}`)
  console.log(`   Total skipped: ${totalSkipped}`)
}

/**
 * Main function
 */
async function main() {
  try {
    // Step 1: Fetch instruments from API
    const instruments = await fetchInstruments()

    // Step 2: Sync to database
    await syncInstrumentsToDatabase(instruments)

    // Step 3: Add default favorites to all users
    await addDefaultFavoritesToAllUsers()

    console.log('\n🎉 All done! Instruments synced and default favorites added.\n')
  } catch (error) {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
main()

