# Trade History API Implementation

## 📋 Overview
This document explains how the trade history API is implemented and how it compares to Postman testing.

## 🔗 API Endpoint
**External API**: `https://metaapi.zuperior.com/api/client/tradehistory/trades`

## 🔐 Authentication Flow

### In Postman:
1. First, get the bearer token by calling:
   - **POST** `https://metaapi.zuperior.com/api/client/ClientAuth/login`
   - **Body**:
     ```json
     {
       "AccountId": 123456,
       "Password": "your_password",
       "DeviceId": "postman_device",
       "DeviceType": "web"
     }
     ```
   - Response contains `accessToken` or `AccessToken`

2. Then call the trade history endpoint:
   - **GET** `https://metaapi.zuperior.com/api/client/tradehistory/trades?accountId=123456&page=1&pageSize=50`
   - **Headers**:
     - `Authorization: Bearer <token_from_step_1>`
     - `AccountId: 123456`

### In Our Implementation:

#### Step 1: API Route (`app/apis/tradehistory/trades/route.ts`)
```typescript
// 1. Extract query parameters
const accountId = searchParams.get('accountId')
const fromDate = searchParams.get('fromDate')
const toDate = searchParams.get('toDate')
// ... etc

// 2. Get client token (internal function)
const { token: accessToken } = await getClientToken(accountId)

// 3. Call external API
const tradesApiUrl = `https://metaapi.zuperior.com/api/client/tradehistory/trades?accountId=${accountId}&...`

const tradesResponse = await fetch(tradesApiUrl, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'AccountId': verifiedAccountId,
    'Content-Type': 'application/json',
  },
})

// 4. Parse response
const responseText = await tradesResponse.text()
const data = JSON.parse(responseText)

// 5. Extract Items array (API returns { Items: [...], Page: 1, ... })
let trades = []
if (data && typeof data === 'object') {
  trades = data.Items || []  // Extract Items array
}

// 6. Return formatted response
return NextResponse.json({
  success: true,
  data: trades,  // The Items array
  pagination: { ... }
})
```

#### Step 2: React Hook (`hooks/useTradeHistory.ts`)
```typescript
// 1. Calculate date range based on period
let fromDate, toDate
// ... calculate dates ...

// 2. Call our internal API route
const res = await fetch(`/apis/tradehistory/trades?accountId=${accountId}&fromDate=${fromDate}&toDate=${toDate}&page=1&pageSize=500`)

// 3. Parse response
const json = await res.json()
// Expected format: { success: true, data: [...] }

// 4. Extract items
let items = []
if (json?.success === true && json?.data) {
  items = Array.isArray(json.data) ? json.data : []
}

// 5. Filter and map to Position format - ONLY closed positions with profit/loss
const validTrades = items.filter(item => {
  const orderId = item.OrderId ?? item.orderId ?? 0
  const symbol = item.Symbol || item.symbol || ''
  const closePrice = item.ClosePrice ?? item.closePrice ?? 0
  const openPrice = item.OpenPrice ?? item.openPrice ?? 0
  const profit = item.Profit ?? item.profit ?? 0
  
  // Only show CLOSED positions with non-zero profit/loss
  return orderId > 0 && symbol.length > 0 && 
         Number(closePrice) > 0 && Number(openPrice) > 0 &&
         Number(profit) !== 0
})

const mapped = validTrades.map(item => ({
  id: `hist-${item.OrderId}`,
  symbol: item.Symbol,
  type: item.OrderType?.toLowerCase().includes('buy') ? 'Buy' : 'Sell',
  volume: item.Volume,
  openPrice: item.OpenPrice,
  currentPrice: item.ClosePrice,
  pnl: item.Profit,
  // ... etc
}))
```

## 📊 Data Flow

```
Postman/External API
    ↓
    Returns: { Items: [...], Page: 1, PageSize: 50, ... }
    ↓
Our API Route (/apis/tradehistory/trades)
    ↓
    Extracts: Items array
    Returns: { success: true, data: [...], pagination: {...} }
    ↓
React Hook (useTradeHistory)
    ↓
    Filters & Maps to Position format
    Returns: Position[]
    ↓
UI Component (PositionsTable)
    ↓
    Displays in "Closed" tab
```

## 🔍 Key Differences from Postman

### 1. **Authentication**
- **Postman**: Manual token retrieval and setting
- **Our Code**: Automatic via `getClientToken()` which:
  - Gets account from database
  - Calls `/client/ClientAuth/login` automatically
  - Returns token for use

### 2. **Response Format**
- **External API**: Returns `{ Items: [...], Page: 1, ... }`
- **Our API Route**: Extracts and returns `{ success: true, data: [...], pagination: {...} }`
- **Hook**: Receives our formatted response and maps to `Position[]`

### 3. **Data Transformation**
- **Postman**: Raw API response
- **Our Code**: 
  - Filters to show ONLY closed positions (ClosePrice > 0 AND OpenPrice > 0)
  - Filters out trades with zero profit (Profit !== 0) - only shows wins or losses
  - Filters out invalid trades (OrderId === 0 with empty Symbol)
  - Filters out open positions and pending orders
  - Maps API fields to Position interface
  - Handles different field name cases (OrderId vs orderId)

## 🐛 Common Issues

### Issue 1: No data showing
**Check**:
1. Browser console for `[Trade History]` logs
2. Network tab - verify API call is made
3. Response format - verify `Items` array exists

### Issue 2: Authentication errors
**Check**:
1. `getClientToken()` function - verify it's getting token
2. AccountId is passed correctly
3. MT5 account exists in database with password

### Issue 3: Data structure mismatch
**Check**:
1. API response has `Items` field (PascalCase)
2. Our code extracts `data.Items`
3. Hook receives `json.data` as array

## 🔧 Debugging

Add console logs at these points:
1. **API Route**: After fetching from external API
2. **API Route**: After extracting Items array
3. **Hook**: After receiving response from our API
4. **Hook**: After filtering and mapping

Example logs:
```
[Trade History] Starting fetch for accountId: 123456
[Trade History] Raw API response: {...}
[Trade History] Extracted items count: 50
[Trade History] Valid trades after filtering: 45
[Trade History] Mapped positions count: 45
```

## ✅ Expected API Response Format

```json
{
  "Items": [
    {
      "OrderId": 113307,
      "Symbol": "BTCUSDm",
      "OrderType": "sell",
      "Volume": 0.001,
      "OpenPrice": 110689.83,
      "ClosePrice": 110689.83,
      "TakeProfit": 0,
      "StopLoss": 0,
      "Profit": 11.68
    }
  ],
  "Page": 1,
  "PageSize": 50,
  "TotalCount": 50,
  "TotalPages": 1,
  "HasNextPage": false,
  "HasPreviousPage": false
}
```

