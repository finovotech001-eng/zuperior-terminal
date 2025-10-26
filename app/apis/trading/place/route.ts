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
    const merged = { ...(body || {}), ...(body?.order || {}) }
    const { side, accountId, symbol, volume, price, stopLoss, takeProfit, comment, orderType } = merged || {}
    if (!side || !accountId || !symbol || typeof volume !== 'number') {
      return NextResponse.json({ success: false, message: 'Missing required fields (side, accountId, symbol, volume)' }, { status: 400 })
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

    // Build upstream request: use trade-sell for sell or sell-* orders
    const sideText = String(side || '').toLowerCase()
    const orderTypeText = String(orderType || '').toLowerCase()
    const isSell = sideText === 'sell' || orderTypeText.startsWith('sell')
    const path = isSell ? 'trade-sell' : 'trade'
    const url = `${API_BASE}/client/${path}?account_id=${encodeURIComponent(mt5.accountId)}`

    // Use symbol exactly as received
    const rawSymbol = String(symbol)

    // Price rules: if no later/limit price chosen, send 0
    const isMarket = (orderTypeText === 'market' || !orderTypeText)
    const sentPrice = isMarket || !price || Number(price) <= 0 ? 0 : Number(price)

    // Volume must be multiplied by 100
    const scaledVolume = Math.round(Number(volume) * 100)

    // SL/TP: if not chosen -> 0; if chosen -> use value as provided (no scaling)
    const hasSL = stopLoss !== undefined && stopLoss !== null && Number(stopLoss) > 0
    const hasTP = takeProfit !== undefined && takeProfit !== null && Number(takeProfit) > 0
    const slValue = hasSL ? Number(stopLoss) : 0
    const tpValue = hasTP ? Number(takeProfit) : 0

    // Comment: default to Buy/Sell if not provided
    const finalComment = comment !== undefined ? String(comment) : (isSell ? 'Sell' : 'Buy')

    const upstreamBody: any = {
      symbol: rawSymbol,
      volume: scaledVolume,
      price: sentPrice,
      stopLoss: slValue,
      takeProfit: tpValue,
      comment: finalComment,
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(upstreamBody),
    })
    const text = await upstream.text().catch(() => '')
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    // Attach minimal debug (no secrets)
    const debug = { symbol: rawSymbol, sentPrice, isMarket, accountId: mt5.accountId, endpoint: url, body: upstreamBody }
    const payload = (data && typeof data === 'object') ? { ...data, debug } : { success: upstream.ok, data, debug }
    return NextResponse.json(payload, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}
