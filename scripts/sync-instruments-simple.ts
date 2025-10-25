/**
 * Simplified script to sync instruments from /api/Symbols to database
 * Customize the API_URL below with your actual endpoint
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ⚠️ CONFIGURE THESE VALUES ⚠️
const API_URL = 'http://localhost:5000/api/Symbols' // Change this to your actual API URL
const REQUIRES_AUTH = false // Set to true if your API needs authentication
const AUTH_TOKEN = '' // If authentication required, add token here

/**
 * Determine category based on symbol
 */
function determineCategory(symbol: string): string {
  const lowerSymbol = symbol.toLowerCase()
  
  if (lowerSymbol.includes('/') && lowerSymbol.length <= 7) return 'forex'
  if (lowerSymbol.includes('usd') && lowerSymbol.length > 3) return 'crypto'
  if (lowerSymbol.startsWith('us') && lowerSymbol.length > 3) return 'indices'
  if (lowerSymbol.startsWith('x')) return 'commodities'
  
  return 'stocks'
}

/**
 * Main sync function
 */
async function syncInstruments() {
  console.log('🚀 Starting instrument sync from /api/Symbols...\n')

  try {
    // Fetch instruments from API
    console.log(`📥 Fetching from: ${API_URL}`)
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (REQUIRES_AUTH && AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
    }

    const response = await fetch(API_URL, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    let rawData = await response.json()

    // Handle different response formats
    if (!Array.isArray(rawData)) {
      // Try common data wrapper properties
      const dataArray = rawData.Data || rawData.Symbols || rawData.data || rawData.symbols
      if (Array.isArray(dataArray)) {
        rawData = dataArray
      } else {
        console.log('Response structure:', Object.keys(rawData))
        throw new Error('Could not find array of symbols in API response')
      }
    }

    console.log(`✅ Fetched ${rawData.length} instruments\n`)

    if (rawData.length === 0) {
      console.log('⚠️  No instruments found in API response')
      return
    }

    // Show sample of first instrument
    console.log('📋 Sample instrument data:')
    console.log(JSON.stringify(rawData[0], null, 2))
    console.log('')

    // Process and save to database
    console.log('💾 Saving to database...')
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of rawData) {
      try {
        // Extract symbol (try different possible field names)
        const symbol = item.Symbol || item.symbol || item.Name || item.name
        if (!symbol) {
          console.log('⚠️  Skipping item without symbol:', item)
          errors++
          continue
        }

        const category = determineCategory(symbol)
        const group = item.Path || item.Group || item.group || item.path || category

        // Upsert instrument
        const result = await prisma.instrument.upsert({
          where: { symbol },
          update: {
            name: item.Name || item.name || symbol,
            description: item.Description || item.description || symbol,
            category,
            group,
            digits: item.Digits || item.digits || 5,
            contractSize: item.ContractSize || item.contractSize || item.contract_size || 100000,
            minVolume: item.VolumeMin || item.volumeMin || item.volume_min || 0.01,
            maxVolume: item.VolumeMax || item.volumeMax || item.volume_max || 100,
            volumeStep: item.VolumeStep || item.volumeStep || item.volume_step || 0.01,
            spread: item.Spread || item.spread || 0,
            isActive: item.TradeMode === 'FULL' || item.tradeMode === 'FULL' || item.Enable === 1 || item.enable === 1 || true,
            tradingHours: item.Sessions || item.sessions || null,
            lastUpdated: new Date(),
          },
          create: {
            symbol,
            name: item.Name || item.name || symbol,
            description: item.Description || item.description || symbol,
            category,
            group,
            digits: item.Digits || item.digits || 5,
            contractSize: item.ContractSize || item.contractSize || item.contract_size || 100000,
            minVolume: item.VolumeMin || item.volumeMin || item.volume_min || 0.01,
            maxVolume: item.VolumeMax || item.volumeMax || item.volume_max || 100,
            volumeStep: item.VolumeStep || item.volumeStep || item.volume_step || 0.01,
            spread: item.Spread || item.spread || 0,
            isActive: item.TradeMode === 'FULL' || item.tradeMode === 'FULL' || item.Enable === 1 || item.enable === 1 || true,
            tradingHours: item.Sessions || item.sessions || null,
          },
        })

        // Check if it was created or updated
        const timeDiff = result.lastUpdated.getTime() - result.createdAt.getTime()
        if (timeDiff < 1000) { // Within 1 second means it was just created
          created++
        } else {
          updated++
        }

        // Progress indicator
        if ((created + updated) % 100 === 0) {
          process.stdout.write(`   Processed: ${created + updated}/${rawData.length}\r`)
        }
      } catch (error) {
        console.error(`❌ Error processing ${item.Symbol || item.symbol || 'unknown'}:`, error)
        errors++
      }
    }

    console.log(`\n✅ Database sync completed!`)
    console.log(`   ✨ Created: ${created}`)
    console.log(`   🔄 Updated: ${updated}`)
    console.log(`   ❌ Errors: ${errors}`)
    console.log(`   📊 Total: ${rawData.length}\n`)

    // Verify sync
    const totalInDb = await prisma.instrument.count()
    console.log(`📊 Total instruments in database: ${totalInDb}`)

    const byCategory = await prisma.instrument.groupBy({
      by: ['category'],
      _count: true,
    })

    console.log('\n📈 Instruments by category:')
    byCategory.forEach(cat => {
      console.log(`   ${cat.category}: ${cat._count}`)
    })

    console.log('\n🎉 Sync completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Sync failed:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
syncInstruments()




