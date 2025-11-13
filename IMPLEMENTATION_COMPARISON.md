# Trade History API - Implementation vs Postman

## 🎯 Exact Implementation Flow

### Our Current Implementation:

#### 1. **Client Request** (React Hook)
```javascript
GET /apis/tradehistory/trades?accountId=123456&fromDate=2025-01-01&toDate=2025-01-31&page=1&pageSize=500
```

#### 2. **Server Route** (`app/apis/tradehistory/trades/route.ts`)
```typescript
// Step 1: Extract accountId from query
const accountId = searchParams.get('accountId')  // "123456"

// Step 2: Get client token
const { token, accountId: verifiedAccountId } = await getClientToken(accountId)
// This calls: POST https://metaapi.zuperior.com/api/client/ClientAuth/login
// With: { AccountId: 123456, Password: "from_db", DeviceId: "web_xxx", DeviceType: "web" }

// Step 3: Build external API URL
const tradesApiUrl = `https://metaapi.zuperior.com/api/client/tradehistory/trades?accountId=${accountId}&fromDate=...&toDate=...&page=1&pageSize=500`

// Step 4: Call external API
fetch(tradesApiUrl, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'AccountId': verifiedAccountId,  // Header
    'Content-Type': 'application/json',
  }
})

// Step 5: Parse response
const responseText = await tradesResponse.text()
const data = JSON.parse(responseText)
// data = { Items: [...], Page: 1, PageSize: 50, ... }

// Step 6: Extract Items
const trades = data.Items || []

// Step 7: Return to client
return { success: true, data: trades, pagination: {...} }
```

#### 3. **React Hook** (`hooks/useTradeHistory.ts`)
```typescript
// Receives: { success: true, data: [...] }
const json = await res.json()
const items = json.data  // Array of trades

// Filter and map
const validTrades = items.filter(...)
const mapped = validTrades.map(item => ({
  symbol: item.Symbol,
  type: item.OrderType?.includes('buy') ? 'Buy' : 'Sell',
  // ...
}))
```

## 🔄 Postman Flow (Working)

### Step 1: Get Token
```
POST https://metaapi.zuperior.com/api/client/ClientAuth/login
Body: {
  "AccountId": 123456,
  "Password": "your_password",
  "DeviceId": "postman",
  "DeviceType": "web"
}
Response: { "accessToken": "..." }
```

### Step 2: Get Trade History
```
GET https://metaapi.zuperior.com/api/client/tradehistory/trades?accountId=123456&page=1&pageSize=50
Headers:
  Authorization: Bearer <token>
  AccountId: 123456
```

## 🔍 Potential Differences

### 1. **Header Case Sensitivity**
- Postman might be case-insensitive
- Our code uses: `'AccountId': verifiedAccountId`
- Try: `'accountId'` or `'Account-ID'` if needed

### 2. **Query Parameter Format**
- Our code: `accountId=123456` (string)
- External API might expect: `AccountId=123456` (different casing)

### 3. **Response Parsing**
- We use `.text()` then `JSON.parse()` to handle edge cases
- This is correct but double-check the response structure

### 4. **Date Format**
- Our code sends: `fromDate=2025-01-01` (YYYY-MM-DD)
- External API might expect different format (ISO 8601 with time?)

## 🐛 Debug Checklist

When testing in browser, check:

1. **Network Tab**:
   - Request URL matches Postman
   - Headers match Postman (especially `Authorization` and `AccountId`)
   - Response status is 200

2. **Console Logs**:
   - `[Trade History] Starting fetch` - confirms hook is running
   - `[Trade History] Raw API response` - shows actual response
   - Check if `json.success === true`
   - Check if `json.data` is an array

3. **Server Logs** (if available):
   - Check `logger.info` output in API route
   - Verify token retrieval succeeded
   - Verify external API call succeeded

## 🔧 Quick Test

To test if the issue is in our code vs external API:

1. Open browser DevTools → Network tab
2. Navigate to Closed tab in app
3. Look for request to `/apis/tradehistory/trades`
4. Click on it and check:
   - **Request Headers**: Does `Authorization` and `AccountId` match Postman?
   - **Response**: What does it return?

## ✅ Expected vs Actual

**Expected Response** (from Postman):
```json
{
  "Items": [
    { "OrderId": 113307, "Symbol": "BTCUSDm", ... }
  ],
  "Page": 1,
  "PageSize": 50
}
```

**What Our Code Expects**:
```json
{
  "success": true,
  "data": [
    { "OrderId": 113307, "Symbol": "BTCUSDm", ... }
  ],
  "pagination": {...}
}
```

**Our API Route Does**:
1. Receives `{ Items: [...] }` from external API
2. Extracts `Items` array
3. Returns `{ success: true, data: Items, pagination: {...} }`

**Hook Does**:
1. Receives `{ success: true, data: [...] }`
2. Extracts `json.data` (which is the Items array)
3. Maps to Position format

