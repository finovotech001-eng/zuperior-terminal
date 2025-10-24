# 🔧 Environment Configuration Template

## Quick Setup

Create a `.env.local` file in the `zuperior-terminal` directory with these settings:

```env
# MT5 API Server URL
NEXT_PUBLIC_API_BASE_URL=http://18.130.5.209:5003

# JWT Secret
JWT_SECRET=your-secret-key-here

# Database URL
DATABASE_URL="file:./prisma/dev.db"
```

---

## Complete Configuration

```env
# =============================================================================
# WEBSOCKET / API CONFIGURATION
# =============================================================================

# MT5 API Base URL (default: http://18.130.5.209:5003)
NEXT_PUBLIC_API_BASE_URL=http://18.130.5.209:5003

# Alternative: Use localhost for development
# NEXT_PUBLIC_API_BASE_URL=http://localhost:5000

# Alternative: Use HTTPS for production
# NEXT_PUBLIC_API_BASE_URL=https://your-domain.com

# =============================================================================
# AUTHENTICATION
# =============================================================================

# JWT Secret (used for token validation)
JWT_SECRET=your-secret-key-here

# =============================================================================
# DATABASE
# =============================================================================

# Database URL for Prisma
DATABASE_URL="file:./prisma/dev.db"

# Alternative: PostgreSQL
# DATABASE_URL="postgresql://user:password@localhost:5432/terminal?schema=public"

# =============================================================================
# FEATURE FLAGS (Optional)
# =============================================================================

# Enable/Disable WebSocket (default: true)
NEXT_PUBLIC_ENABLE_WEBSOCKET=true

# Enable mock data when WebSocket fails (default: true)
NEXT_PUBLIC_ENABLE_MOCK_DATA=true

# Enable verbose WebSocket logging (default: false)
NEXT_PUBLIC_WS_DEBUG=false
```

---

## Important Notes

### 1. WebSocket Connection

The app will automatically convert HTTP URLs to WebSocket URLs:

```
NEXT_PUBLIC_API_BASE_URL=http://example.com:5003
↓
WebSocket URL: ws://example.com:5003/hubs/livedata
```

For HTTPS:
```
NEXT_PUBLIC_API_BASE_URL=https://example.com
↓
WebSocket URL: wss://example.com/hubs/livedata
```

### 2. CORS Configuration

Your MT5 server must allow requests from your frontend URL:

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

### 3. Fallback Behavior

If WebSocket connection fails, the app will:
- ✅ Continue working with mock data
- ⚠️ Show warning in console
- ○ Display "Offline" status indicator
- No errors thrown

### 4. Testing Connection

To test if your server is accessible:

```bash
# Test HTTP endpoint
curl http://18.130.5.209:5003/health

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c ws://18.130.5.209:5003/hubs/livedata
```

---

## Troubleshooting

### Issue: "Failed to fetch" error

**Possible causes:**
1. Server is not running
2. Wrong URL in `.env.local`
3. CORS blocking the request
4. Firewall/network blocking connection

**Solutions:**
1. Check if server is accessible: `curl http://your-server:port/health`
2. Verify URL in `.env.local` is correct
3. Check server CORS settings
4. Try from a different network

### Issue: WebSocket connects but no data

**Possible causes:**
1. JWT token is missing or invalid
2. Symbol format doesn't match server
3. Not subscribed to symbol

**Solutions:**
1. Check if JWT token is in localStorage
2. Verify symbol format (e.g., "EURUSD" not "EUR/USD")
3. Check console for subscription logs

### Issue: App shows "Server offline"

**This is normal!** The app is designed to work offline with mock data.

To use real data:
1. Ensure MT5 server is running
2. Configure correct URL in `.env.local`
3. Restart dev server: `npm run dev`

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | No | `http://18.130.5.209:5003` | MT5 server URL |
| `JWT_SECRET` | Yes | - | Secret for JWT validation |
| `DATABASE_URL` | Yes | - | Prisma database connection |
| `NEXT_PUBLIC_ENABLE_WEBSOCKET` | No | `true` | Enable WebSocket |
| `NEXT_PUBLIC_ENABLE_MOCK_DATA` | No | `true` | Fallback to mock data |
| `NEXT_PUBLIC_WS_DEBUG` | No | `false` | Verbose logging |

---

## Quick Commands

```bash
# Create .env.local from template
cat > .env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://18.130.5.209:5003
JWT_SECRET=your-secret-key
DATABASE_URL="file:./prisma/dev.db"
EOF

# Restart dev server to apply changes
npm run dev

# Check current environment
node -e "console.log(process.env.NEXT_PUBLIC_API_BASE_URL)"
```

---

## Production Deployment

For production, set these in your hosting platform (Vercel, Netlify, etc.):

```env
NEXT_PUBLIC_API_BASE_URL=https://your-production-server.com
JWT_SECRET=your-production-secret-key
DATABASE_URL=postgresql://user:password@host:5432/db
```

**Important:**
- Use HTTPS/WSS for production
- Never commit `.env.local` to git
- Use different secrets for dev/prod
- Enable CORS for your production domain

---

## Support

If you're still having issues:

1. Check browser console (F12) for errors
2. Look for "⚠️" warnings about connection
3. Verify server is running: `curl http://your-server:port/health`
4. Check network tab in DevTools for failed requests

**Remember:** The app works offline with mock data, so it will never completely break!

