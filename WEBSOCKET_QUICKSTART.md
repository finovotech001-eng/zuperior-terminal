# 🚀 WebSocket Quick Start Guide

## What's New?

Your terminal now has **real-time market pricing** via WebSockets! No more polling - prices update instantly as they change on the MT5 server.

---

## ⚡ Quick Test (2 minutes)

### Step 1: Start the Dev Server
```bash
cd zuperior-terminal
npm run dev
```

### Step 2: Open Terminal Page
Navigate to: http://localhost:3000/terminal

### Step 3: Check Connection Status
Look at the **top-right corner** of the navbar. You should see:
```
● Live
```
- **Green dot (●)** = Connected to WebSocket
- **Yellow dot (◐)** = Connecting...
- **Red circle (○)** = Disconnected

### Step 4: Watch Real-Time Prices
1. Select any instrument from the left panel
2. Look at the **Order Panel** on the right
3. You should see:
   - **Buy** and **Sell** prices updating in real-time
   - A **green dot** next to the spread = WebSocket is active
   - Prices change as market moves

### Step 5: Open Browser Console
Press `F12` and check for:
```
✅ Connected to Live Data Hub
✅ Subscribed to EURUSD
```

---

## 📊 Visual Confirmation

### Before (Static Prices):
```
Sell: 4354.896
Buy:  4355.056
0.16 USD
```

### After (Live Prices):
```
Sell: 4354.912    ← Changes in real-time
Buy:  4355.068    ← Changes in real-time  
0.16 USD ● Live   ← Green dot = WebSocket active
```

---

## 🔍 What's Happening Behind the Scenes?

```
Your Browser
    ↓
WebSocket Connection (SignalR)
    ↓
MT5 Server (18.130.5.209:5003)
    ↓
Real-Time Price Updates
    ↓
Order Panel Updates Automatically
```

---

## 🎯 Key Features

### ✅ Automatic Connection
- Connects automatically when terminal page loads
- No manual setup required
- Auto-reconnects if connection drops

### ✅ Per-Instrument Subscription
- Only subscribes to instruments you're actively viewing
- Automatically unsubscribes when you close a tab
- Memory efficient - no wasted bandwidth

### ✅ Graceful Fallback
- If WebSocket isn't connected yet, shows mock prices
- Seamless transition to real-time when connected
- No "loading" states visible to user

### ✅ Connection Status
- Visual indicator in navbar
- Green dot in Order Panel when prices are live
- Console logs for debugging

---

## 🛠️ For Developers

### How to Use WebSocket in Your Component

```typescript
import { useTickPrice } from '@/hooks/useWebSocket'

function MyComponent({ symbol }) {
  // Subscribe to real-time prices
  const { bid, ask, spread, isSubscribed } = useTickPrice(symbol)

  return (
    <div>
      <div>Bid: {bid || 'Loading...'}</div>
      <div>Ask: {ask || 'Loading...'}</div>
      {isSubscribed && <span>● Live</span>}
    </div>
  )
}
```

### How to Initialize WebSocket

```typescript
import { useWebSocketConnection } from '@/hooks/useWebSocket'

function App() {
  // Connect to all WebSocket hubs
  const { isConnected, isConnecting, error } = useWebSocketConnection()

  return (
    <div>
      {isConnecting && <div>Connecting...</div>}
      {isConnected && <div>✅ Connected</div>}
      {error && <div>Error: {error}</div>}
    </div>
  )
}
```

---

## 🔧 Configuration

### Default Settings
- **Server**: http://18.130.5.209:5003
- **Reconnect Delay**: 5 seconds
- **Authentication**: JWT from localStorage

### Change Server URL
Edit `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://your-server:port
```

---

## 📝 Files Added

1. **`lib/websocket-service.ts`** - Core WebSocket manager
2. **`hooks/useWebSocket.ts`** - React hooks for easy use
3. **`components/data-display/websocket-status.tsx`** - Status indicator
4. **`WEBSOCKET_IMPLEMENTATION.md`** - Full documentation

---

## 🐛 Troubleshooting

### ❌ Seeing "○ Offline"?
**Possible causes:**
1. MT5 server is down
2. Wrong server URL in `.env.local`
3. Network/firewall blocking WebSocket

**Fix:**
```bash
# Check server URL
echo $NEXT_PUBLIC_API_BASE_URL

# Check browser console for errors (F12)
# Look for: "Failed to connect to Live Data Hub"
```

### ❌ Prices not updating?
**Possible causes:**
1. Symbol format doesn't match MT5 (use "EURUSD" not "EUR/USD")
2. Not subscribed to symbol (check console)
3. WebSocket disconnected

**Fix:**
1. Check WebSocket status indicator (should be green)
2. Look for console log: `✅ Subscribed to EURUSD`
3. Try selecting a different instrument

### ❌ Console errors?
**Common errors:**
- `401 Unauthorized` → JWT token missing/invalid
- `ECONNREFUSED` → Server is down
- `CORS error` → Server doesn't allow your origin

**Fix:**
- Check if you're logged in (JWT in localStorage)
- Verify server is running
- Check server CORS configuration

---

## 📚 Next Steps

### For Users:
- ✅ WebSocket is now active - enjoy real-time pricing!
- No action needed - it works automatically

### For Developers:
- 📖 Read `WEBSOCKET_IMPLEMENTATION.md` for full API docs
- 🔧 Integrate real-time candles in chart (coming next)
- 🧪 Test with different instruments and timeframes

---

## 🎉 That's It!

WebSocket is now **live and working**. Your terminal receives **real-time market data** with:
- ✅ Instant price updates
- ✅ Auto-reconnection
- ✅ Efficient bandwidth usage
- ✅ No polling overhead

Enjoy your real-time trading terminal! 📈🚀

---

**Questions?** Check the full documentation: `WEBSOCKET_IMPLEMENTATION.md`


