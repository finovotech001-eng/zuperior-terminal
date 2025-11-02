/**
 * Test script to call the trade history API through Next.js API route
 * Usage: npx tsx scripts/test-trade-history-api.ts <accountId>
 * 
 * Note: This requires the Next.js dev server to be running
 * Start it with: npm run dev
 */

const NEXT_JS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'

async function testTradeHistoryAPI(accountId: string) {
  console.log('='.repeat(80))
  console.log('Testing Trade History API (via Next.js API Route)')
  console.log('='.repeat(80))
  console.log(`Account ID: ${accountId}`)
  console.log(`Next.js URL: ${NEXT_JS_URL}`)
  console.log()
  console.log('⚠️  Make sure your Next.js dev server is running (npm run dev)')
  console.log()

  try {
    // Call our Next.js API route which handles authentication
    console.log('Calling Next.js API route: /apis/tradehistory/trades')
    const apiUrl = `${NEXT_JS_URL}/apis/tradehistory/trades?accountId=${accountId}`
    console.log('URL:', apiUrl)
    console.log()
    
    const tradesResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    console.log('Trade History Response Status:', tradesResponse.status, tradesResponse.statusText)
    console.log()
    
    if (!tradesResponse.ok) {
      const errorText = await tradesResponse.text()
      console.error('Trade history fetch failed:', errorText)
      return
    }
    
    // Step 3: Parse and display response
    const responseText = await tradesResponse.text()
    console.log('Raw Response Length:', responseText.length)
    console.log('Raw Response Preview (first 500 chars):')
    console.log(responseText.substring(0, 500))
    console.log()
    
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError)
      console.log('Full response text:')
      console.log(responseText)
      return
    }
    
    console.log('='.repeat(80))
    console.log('PARSED RESPONSE STRUCTURE')
    console.log('='.repeat(80))
    console.log('Type:', typeof data)
    console.log('Is Array:', Array.isArray(data))
    console.log('Keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A')
    console.log()
    
    // Extract trades
    let trades: any[] = []
    if (Array.isArray(data)) {
      trades = data
      console.log('✓ Response is direct array with', trades.length, 'items')
    } else if (data && typeof data === 'object') {
      trades = data.Items || data.Data || data.data || data.trades || data.items || data.results || data.Results || []
      const source = data.Items ? 'Items' :
                    data.Data ? 'Data' : 
                    data.data ? 'data' : 
                    data.trades ? 'trades' : 
                    data.items ? 'items' : 
                    data.results ? 'results' : 
                    data.Results ? 'Results' : 'none'
      console.log(`✓ Extracted ${trades.length} trades from ${source} field`)
      console.log('All keys in response:', Object.keys(data))
    }
    
    console.log()
    console.log('='.repeat(80))
    console.log('TRADES DATA')
    console.log('='.repeat(80))
    console.log('Total trades:', trades.length)
    console.log()
    
    if (trades.length > 0) {
      console.log('First trade (full object):')
      console.log(JSON.stringify(trades[0], null, 2))
      console.log()
      
      console.log('All trades summary:')
      trades.forEach((trade, index) => {
        console.log(`  [${index + 1}] OrderId: ${trade.OrderId}, Symbol: "${trade.Symbol}", Volume: ${trade.Volume}, OpenPrice: ${trade.OpenPrice}, Profit: ${trade.Profit}`)
      })
      console.log()
      
      console.log('='.repeat(80))
      console.log('FIELD ANALYSIS')
      console.log('='.repeat(80))
      const sample = trades[0]
      console.log('Sample trade fields:')
      Object.keys(sample).forEach(key => {
        const value = sample[key]
        console.log(`  ${key}: ${JSON.stringify(value)} (${typeof value})`)
      })
    } else {
      console.warn('⚠ No trades found in response!')
      console.log('Full response:')
      console.log(JSON.stringify(data, null, 2))
    }
    
  } catch (error) {
    console.error('Error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
  }
}

// Get accountId from command line args
const accountId = process.argv[2] || '19877161'

if (!accountId) {
  console.error('Usage: npx tsx scripts/test-trade-history-api.ts <accountId>')
  console.error('Make sure Next.js dev server is running: npm run dev')
  process.exit(1)
}

testTradeHistoryAPI(accountId)
  .then(() => {
    console.log()
    console.log('='.repeat(80))
    console.log('Test completed')
    console.log('='.repeat(80))
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

