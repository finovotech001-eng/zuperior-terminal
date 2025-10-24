/**
 * Sync instruments from API using environment variables
 * Uses NEXT_PUBLIC_API_BASE_URL and SYMBOLS_PATH from .env.local
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Load from environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
const SYMBOLS_PATH = process.env.SYMBOLS_PATH || '/api/Symbols'
const AUTH_TOKEN = process.env.API_AUTH_TOKEN || '' // Optional auth token

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
  console.log('🚀 Starting instrument sync from API...\n')
  
  const fullUrl = `${API_BASE_URL}${SYMBOLS_PATH}`
  console.log(`📡 API URL: ${fullUrl}`)
  console.log(`🔑 Auth Token: ${AUTH_TOKEN ? '***configured***' : 'not configured'}\n`)

  try {
    // Fetch instruments from API
    console.log(`📥 Fetching symbols...`)
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    let rawData = await response.json()
    console.log(`✅ API Response received\n`)

    // Handle different response formats
    if (!Array.isArray(rawData)) {
      console.log('📦 Response is an object, looking for array...')
      const dataArray = rawData.Data || rawData.Symbols || rawData.data || rawData.symbols || rawData.result
      if (Array.isArray(dataArray)) {
        console.log(`✅ Found array in: ${Object.keys(rawData).find(k => rawData[k] === dataArray)}`)
        rawData = dataArray
      } else {
        console.log('❌ Response structure:', Object.keys(rawData))
        console.log('\n📄 Full response sample:')
        console.log(JSON.stringify(rawData, null, 2).substring(0, 500) + '...')
        throw new Error('Could not find array of symbols in API response')
      }
    }

    console.log(`✅ Found ${rawData.length} instruments\n`)

    if (rawData.length === 0) {
      console.log('⚠️  No instruments found in API response')
      return
    }

    // Show sample of first instrument
    console.log('📋 Sample instrument (first item):')
    console.log(JSON.stringify(rawData[0], null, 2))
    console.log('')

    // Ask for confirmation
    console.log(`\n⚠️  About to sync ${rawData.length} instruments to database`)
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Process and save to database
    console.log('💾 Saving to database...')
    let created = 0
    let updated = 0
    let errors = 0
    const errorDetails: Array<{ symbol: string; error: string }> = []

    for (const item of rawData) {
      try {
        // Extract symbol (try different possible field names)
        const symbol = item.Symbol || item.symbol || item.Name || item.name || item.SYMBOL
        if (!symbol) {
          errors++
          errorDetails.push({ symbol: 'unknown', error: 'No symbol field found' })
          continue
        }

        const category = determineCategory(symbol)
        const group = item.Path || item.Group || item.group || item.path || item.category || category

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
            spread: Number(item.Spread || item.spread || 0),
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
            spread: Number(item.Spread || item.spread || 0),
            isActive: item.TradeMode === 'FULL' || item.tradeMode === 'FULL' || item.Enable === 1 || item.enable === 1 || true,
            tradingHours: item.Sessions || item.sessions || null,
          },
        })

        // Check if it was created or updated
        const timeDiff = result.lastUpdated.getTime() - result.createdAt.getTime()
        if (timeDiff < 1000) {
          created++
        } else {
          updated++
        }

        // Progress indicator
        const total = created + updated + errors
        if (total % 50 === 0) {
          process.stdout.write(`   Progress: ${total}/${rawData.length} (${Math.round(total/rawData.length*100)}%)\r`)
        }
      } catch (error) {
        const symbolName = item.Symbol || item.symbol || 'unknown'
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors++
        errorDetails.push({ symbol: symbolName, error: errorMsg })
        if (errors <= 5) { // Only log first 5 errors
          console.error(`\n❌ Error processing ${symbolName}:`, errorMsg)
        }
      }
    }

    console.log(`\n\n✅ Database sync completed!`)
    console.log(`┌─────────────────────────────────┐`)
    console.log(`│   ✨ Created:  ${created.toString().padStart(4)}           │`)
    console.log(`│   🔄 Updated:  ${updated.toString().padStart(4)}           │`)
    console.log(`│   ❌ Errors:   ${errors.toString().padStart(4)}           │`)
    console.log(`│   📊 Total:    ${rawData.length.toString().padStart(4)}           │`)
    console.log(`└─────────────────────────────────┘\n`)

    if (errors > 5) {
      console.log(`⚠️  ${errors - 5} more errors occurred (showing first 5 only)`)
    }

    // Verify sync
    const totalInDb = await prisma.instrument.count()
    console.log(`📊 Total instruments in database: ${totalInDb}\n`)

    const byCategory = await prisma.instrument.groupBy({
      by: ['category'],
      _count: true,
    })

    console.log('📈 Breakdown by category:')
    byCategory.forEach(cat => {
      const bar = '█'.repeat(Math.min(Math.round(cat._count / 10), 50))
      console.log(`   ${cat.category.padEnd(12)} ${bar} ${cat._count}`)
    })

    console.log('\n🎉 Sync completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Sync failed:', error)
    if (error instanceof Error) {
      console.error('\n📝 Error details:')
      console.error(`   Message: ${error.message}`)
      console.error(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`)
    }
    
    console.error('\n💡 Troubleshooting:')
    console.error('   1. Check your API URL is correct')
    console.error('   2. Ensure the API is running and accessible')
    console.error('   3. Verify authentication token if required')
    console.error('   4. Check .env.local has NEXT_PUBLIC_API_BASE_URL and SYMBOLS_PATH')
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
syncInstruments()

