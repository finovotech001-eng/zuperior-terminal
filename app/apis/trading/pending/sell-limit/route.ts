import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

const API_BASE = (process.env.LIVE_API_URL || 'https://metaapi.zuperior.com/api').replace(/\/$/, '')
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({} as any))
    const { accountId, symbol, price, volume, stopLoss, takeProfit, comment, accessToken } = body || {}
    if (!accountId || !symbol || typeof price !== 'number' || typeof volume !== 'number') {
      return NextResponse.json({ success: false, message: 'Missing required fields (accountId, symbol, price, volume)' }, { status: 400 })
    }

    // Use client token if provided, otherwise login via DB credentials
    let token: string | null = typeof accessToken === 'string' && accessToken.length > 10 ? accessToken : null
    if (!token) {
      const mt5 = await prisma.mT5Account.findFirst({ where: { userId: session.userId, accountId: String(accountId) }, select: { accountId: true, password: true } })
      if (!mt5 || !mt5.password) return NextResponse.json({ success: false, message: 'MT5 account not found or password not set' }, { status: 400 })
      const loginRes = await fetch(`${API_BASE}/client/ClientAuth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ AccountId: parseInt(mt5.accountId, 10), Password: mt5.password, DeviceId: `web_${session.userId}`, DeviceType: 'web' }) })
      if (!loginRes.ok) return NextResponse.json({ success: false, message: `Login failed: ${loginRes.status}` }, { status: 502 })
      const loginJson: any = await loginRes.json().catch(() => ({}))
      token = loginJson?.accessToken || loginJson?.AccessToken || loginJson?.Token || loginJson?.data?.accessToken
      if (!token) return NextResponse.json({ success: false, message: 'No access token received' }, { status: 502 })
    }

    // Convert volume to contract units (multiply by 100)
    const scaledVolume = Math.round(Number(volume) * 100)

    // Use unified /client/orders endpoint for all pending order types
    // OrderType: 2 = Buy Limit, 3 = Sell Limit, 4 = Buy Stop, 5 = Sell Stop
    const url = `${API_BASE}/client/orders`
    const upstreamBody = { 
      Login: parseInt(String(accountId), 10),
      Symbol: String(symbol),
      OrderType: 3, // 3 = Sell Limit
      Price: Number(price), 
      Volume: scaledVolume,
      StopLoss: Number(stopLoss || 0), 
      TakeProfit: Number(takeProfit || 0), 
      Comment: comment ?? 'Sell Limit via web' 
    }
    
    try { console.log('[sell-limit] request', { url, body: upstreamBody }) } catch {}
    
    const upstream = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(upstreamBody) })
    const text = await upstream.text().catch(() => '')
    let data: any = null; try { data = text ? JSON.parse(text) : null } catch { data = text }
    
    try { console.log('[sell-limit] response', { status: upstream.status, data }) } catch {}
    
    const payload = (data && typeof data === 'object') ? { ...data, debug: { url, req: upstreamBody, status: upstream.status } } : { success: upstream.ok, data, debug: { url, req: upstreamBody, status: upstream.status } }
    return NextResponse.json(payload, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}

