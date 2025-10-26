import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

const API_BASE = (process.env.LIVE_API_URL || 'http://18.130.5.209:5003/api').replace(/\/$/, '')

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({} as any))
    const { side, accountId, symbol, volume, price, stopLoss, takeProfit, comment, orderType } = body || {}
    if (!side || !accountId || !symbol || typeof volume !== 'number' || typeof price !== 'number') {
      return NextResponse.json({ success: false, message: 'Missing required fields (side, accountId, symbol, volume, price)' }, { status: 400 })
    }

    // Verify user owns the account; get password for token fetch
    const mt5 = await prisma.mT5Account.findFirst({
      where: { userId: session.userId, accountId: String(accountId) },
      select: { accountId: true, password: true },
    })
    if (!mt5 || !mt5.password) {
      return NextResponse.json({ success: false, message: 'MT5 account not found or password not set' }, { status: 400 })
    }

    // Login to get MT5 token
    const loginRes = await fetch(`${API_BASE}/client/ClientAuth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        AccountId: parseInt(mt5.accountId, 10),
        Password: mt5.password,
        DeviceId: `web_${session.userId}`,
        DeviceType: 'web',
      }),
    })
    if (!loginRes.ok) {
      const txt = await loginRes.text().catch(() => '')
      return NextResponse.json({ success: false, message: `Login failed: ${txt || loginRes.status}` }, { status: 502 })
    }
    const loginJson = await loginRes.json().catch(() => ({} as any))
    const token = loginJson?.accessToken || loginJson?.AccessToken || loginJson?.Token || loginJson?.data?.accessToken
    if (!token) {
      return NextResponse.json({ success: false, message: 'No access token received' }, { status: 502 })
    }

    // Build upstream request
    const path = side.toLowerCase() === 'sell' ? 'trade-sell' : 'trade'
    const url = `${API_BASE}/client/${path}?account_id=${encodeURIComponent(mt5.accountId)}`

    // Normalize symbol: lowercase and remove slash (EUR/USD -> eurusd)
    let normalizedSymbol = String(symbol).toLowerCase().replace('/', '')

    // Try to map to an exact tradable symbol from /api/Symbols (handles suffixes like 'm')
    try {
      const symRes = await fetch(`${API_BASE}/Symbols`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (symRes.ok) {
        const txt = await symRes.text().catch(() => '')
        let json: any = null
        try { json = txt ? JSON.parse(txt) : null } catch { json = null }
        const list: any[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : [])
        if (Array.isArray(list) && list.length) {
          const toLower = (v: any) => (typeof v === 'string' ? v.toLowerCase() : '')
          const extractName = (it: any) => toLower(it?.Symbol ?? it?.symbol ?? it?.Name ?? it?.name ?? it?.Code ?? it?.code)
          const names = list.map(extractName).filter(Boolean)
          const exact = names.find(n => n === normalizedSymbol)
          const withM = names.find(n => n === `${normalizedSymbol}m`)
          const alt = names.find(n => n.replace('/', '') === normalizedSymbol)
          if (exact) normalizedSymbol = exact
          else if (withM) normalizedSymbol = withM
          else if (alt) normalizedSymbol = alt
        }
      }
    } catch {}
    const isMarket = (String(orderType || '').toLowerCase() === 'market' || !orderType)
    const sentPrice = isMarket ? 0 : Number(price)

    const upstreamBody: any = {
      Symbol: normalizedSymbol,
      Volume: Math.round(volume * 10000),
      // For market orders MT5 expects Price=0 (server executes at market)
      Price: sentPrice,
    }
    if (stopLoss !== undefined) upstreamBody.StopLoss = Number(stopLoss)
    if (takeProfit !== undefined) upstreamBody.TakeProfit = Number(takeProfit)
    if (comment !== undefined) upstreamBody.Comment = String(comment)

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(upstreamBody),
    })
    const text = await upstream.text().catch(() => '')
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    // Attach minimal debug (no secrets)
    const debug = { normalizedSymbol, sentPrice, isMarket, accountId: mt5.accountId, endpoint: url, body: upstreamBody }
    const payload = (data && typeof data === 'object') ? { ...data, debug } : { success: upstream.ok, data, debug }
    return NextResponse.json(payload, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}
