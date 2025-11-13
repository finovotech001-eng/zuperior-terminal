import { NextRequest, NextResponse } from 'next/server'

// Debug route to test LiveData tick REST API via server-side proxy
// Usage: GET /apis/debug/tick?symbol=EURUSD&accountId=123456

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = (searchParams.get('symbol') || 'EURUSD').replace('/', '')
    const accountId = searchParams.get('accountId') || undefined
    const providedToken = searchParams.get('token') || undefined

    // Acquire token using existing mt5-login route if accountId is provided
    let token: string | null = providedToken || null
    if (!token && accountId) {
      // Build absolute URL for internal call
      const loginUrl = new URL('/apis/auth/mt5-login', req.url).toString()
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      })
      if (!loginRes.ok) {
        const txt = await loginRes.text().catch(() => '')
        return NextResponse.json({ ok: false, step: 'mt5-login', status: loginRes.status, error: txt }, { status: 502 })
      }
      const loginJson = await loginRes.json().catch(() => ({} as any))
      token = loginJson?.data?.accessToken || null
    }

    // Call remote tick endpoint
    const API_BASE = (process.env.LIVE_API_URL || 'https://metaapi.zuperior.com/api').replace(/\/$/, '')
    const url = `${API_BASE}/livedata/tick/${encodeURIComponent(symbol)}`
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    })

    const text = await upstream.text().catch(() => '')
    let body: any = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }

    return NextResponse.json({ ok: upstream.ok, status: upstream.status, tokenUsed: !!token, symbol, endpoint: url, body }, { status: upstream.ok ? 200 : upstream.status || 502 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
