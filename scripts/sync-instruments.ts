/**
 * Script to sync instruments from external API to database
 * Run this once on initial setup
 */

import { prisma } from '../lib/prisma'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const MARKET_DATA_SYMBOLS_PATH = process.env.MARKET_DATA_SYMBOLS_PATH
const MANAGER_USERNAME = process.env.MANAGER_USERNAME
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD
const MANAGER_SERVER_IP = process.env.MANAGER_SERVER_IP
const MANAGER_PORT = process.env.MANAGER_PORT || '443'
const MANAGER_LOGIN_PATH = process.env.MANAGER_LOGIN_PATH

/**
 * Get Master Token for API authentication
 */
async function getMasterToken(): Promise<{ token: string | null; error: string | null }> {
  if (!API_BASE_URL || !MANAGER_USERNAME || !MANAGER_PASSWORD || !MANAGER_LOGIN_PATH) {
    return { token: null, error: 'Missing environment variables.' }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${MANAGER_LOGIN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Username: MANAGER_USERNAME,
        Password: MANAGER_PASSWORD,
        Server: MANAGER_SERVER_IP,
        Port: parseInt(MANAGER_PORT, 10),
      }),
    })

    if (!response.ok) {
      return { token: null, error: `Manager login failed: ${response.status}` }
    }

    const data = await response.json()
    const token = data.Token || data.AccessToken || null

    if (!token) {
      return { token: null, error: 'No token in response' }
    }

    return { token, error: null }
  } catch (error) {
    console.error('Master token fetch error:', error)
    return { token: null, error: 'Network error' }
  }
}

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
  console.log('🚀 Starting instrument sync...\n')

  try {
    // Step 1: Get authentication token
    console.log('📡 Getting authentication token...')
    const { token: masterToken, error: tokenError } = await getMasterToken()
    
    if (!masterToken) {
      throw new Error(tokenError || 'Failed to get authentication token')
    }
    console.log('✅ Authentication successful\n')

    // Step 2: Fetch instruments from external API
    console.log('📥 Fetching instruments from external API...')
    const instrumentsResponse = await fetch(`${API_BASE_URL}${MARKET_DATA_SYMBOLS_PATH}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${masterToken}`,
      },
    })

    if (!instrumentsResponse.ok) {
      throw new Error(`Failed to fetch instruments: ${instrumentsResponse.status}`)
    }

    let rawData = await instrumentsResponse.json()

    // Handle different response formats
    if (!Array.isArray(rawData)) {
      const dataArray = rawData.Data || rawData.Symbols || rawData.data
      if (Array.isArray(dataArray)) {
        rawData = dataArray
      } else {
        rawData = []
      }
    }

    console.log(`✅ Fetched ${rawData.length} instruments\n`)

    // Step 3: Process and save to database
    console.log('💾 Saving to database...')
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of rawData) {
      try {
        const symbol = item.Symbol || item.Name || item.symbol
        if (!symbol) {
          errors++
          continue
        }

        const category = determineCategory(symbol)
        const group = item.Path || item.Group || item.group || category

        // Upsert instrument
        const result = await prisma.instrument.upsert({
          where: { symbol },
          update: {
            name: item.Name || item.name || symbol,
            description: item.Description || item.description || symbol,
            category,
            group,
            digits: item.Digits || item.digits || 5,
            contractSize: item.ContractSize || item.contractSize || 100000,
            minVolume: item.VolumeMin || item.volumeMin || 0.01,
            maxVolume: item.VolumeMax || item.volumeMax || 100,
            volumeStep: item.VolumeStep || item.volumeStep || 0.01,
            spread: item.Spread || item.spread || 0,
            isActive: item.TradeMode === 'FULL' || item.tradeMode === 'FULL' || true,
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
            contractSize: item.ContractSize || item.contractSize || 100000,
            minVolume: item.VolumeMin || item.volumeMin || 0.01,
            maxVolume: item.VolumeMax || item.volumeMax || 100,
            volumeStep: item.VolumeStep || item.volumeStep || 0.01,
            spread: item.Spread || item.spread || 0,
            isActive: item.TradeMode === 'FULL' || item.tradeMode === 'FULL' || true,
            tradingHours: item.Sessions || item.sessions || null,
          },
        })

        // Check if it was created or updated
        if (result.createdAt.getTime() === result.lastUpdated.getTime()) {
          created++
        } else {
          updated++
        }

        // Progress indicator
        if ((created + updated) % 100 === 0) {
          process.stdout.write(`   Processed: ${created + updated}/${rawData.length}\r`)
        }
      } catch (error) {
        console.error(`Error processing ${item.Symbol || 'unknown'}:`, error)
        errors++
      }
    }

    console.log(`\n✅ Database sync completed!`)
    console.log(`   Created: ${created}`)
    console.log(`   Updated: ${updated}`)
    console.log(`   Errors: ${errors}`)
    console.log(`   Total: ${rawData.length}\n`)

    // Step 4: Verify sync
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
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
syncInstruments()

