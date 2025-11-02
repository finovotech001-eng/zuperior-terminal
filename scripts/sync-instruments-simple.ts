/**
 * Simplified script to sync instruments from a Symbols API into the database
 *
 * Configuration (env vars):
 * - SYMBOLS_API_URL=https://host/api/Symbols
 * - SYMBOLS_API_REQUIRES_AUTH=true|false
 * - SYMBOLS_API_TOKEN=your_token
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const API_URL = process.env.SYMBOLS_API_URL || 'http://localhost:5000/api/Symbols/Categories'
const REQUIRES_AUTH = (process.env.SYMBOLS_API_REQUIRES_AUTH || 'false').toLowerCase() === 'true'
const AUTH_TOKEN = process.env.SYMBOLS_API_TOKEN || ''

function determineCategory(symbol: string): string {
  const lowerSymbol = symbol.toLowerCase()
  if (lowerSymbol.includes('/') && lowerSymbol.length <= 7) return 'forex'
  if (lowerSymbol.includes('usd') && lowerSymbol.length > 3) return 'crypto'
  if (lowerSymbol.startsWith('us') && lowerSymbol.length > 3) return 'indices'
  if (lowerSymbol.startsWith('x')) return 'commodities'
  return 'stocks'
}

async function syncInstruments() {
  console.log('Starting instrument sync from Symbols API...\n')

  try {
    console.log(`Fetching from: ${API_URL}`)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (REQUIRES_AUTH && AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
    }

    const response = await fetch(API_URL, { method: 'GET', headers })
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    let rawData: any = await response.json()

    if (!Array.isArray(rawData)) {
      const dataArray = rawData.Data || rawData.Symbols || rawData.data || rawData.symbols
      if (Array.isArray(dataArray)) {
        rawData = dataArray
      } else {
        console.log('Response structure keys:', Object.keys(rawData))
        throw new Error('Could not find array of symbols in API response')
      }
    }

    console.log(`Fetched ${rawData.length} instruments\n`)
    if (rawData.length === 0) {
      console.log('No instruments found in API response')
      return
    }

    console.log('Sample instrument data:')
    console.log(JSON.stringify(rawData[0], null, 2))
    console.log('')

    console.log('Saving to database...')
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of rawData) {
      try {
        const symbol = item.Symbol || item.symbol || item.Name || item.name
        if (!symbol) {
          console.log('Skipping item without symbol')
          errors++
          continue
        }

        const category = determineCategory(symbol)
        const group = item.Path || item.Group || item.group || item.path || category

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

        const timeDiff = result.lastUpdated.getTime() - result.createdAt.getTime()
        if (timeDiff < 1000) created++
        else updated++

        if ((created + updated) % 100 === 0) {
          process.stdout.write(`   Processed: ${created + updated}/${rawData.length}\r`)
        }
      } catch (error) {
        console.error(`Error processing ${item?.Symbol || item?.symbol || 'unknown'}:`, error)
        errors++
      }
    }

    console.log(`\nDatabase sync completed!`)
    console.log(`   Created: ${created}`)
    console.log(`   Updated: ${updated}`)
    console.log(`   Errors: ${errors}`)
    console.log(`   Total: ${rawData.length}\n`)

    const totalInDb = await prisma.instrument.count()
    console.log(`Total instruments in database: ${totalInDb}`)

    const byCategory = await prisma.instrument.groupBy({ by: ['category'], _count: true })
    console.log('\nInstruments by category:')
    byCategory.forEach(cat => {
      console.log(`   ${cat.category}: ${cat._count}`)
    })

    console.log('\nSync completed successfully!\n')
  } catch (error) {
    console.error('\nSync failed:', error)
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

