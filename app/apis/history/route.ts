import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// Helper to attempt fetch with graceful fallback
async function tryFetch(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, init)
    if (!res.ok) return { ok: false, status: res.status, body: await res.text().catch(() => '') }
    const data = await res.json().catch(() => ({}))
    return { ok: true, status: 200, body: data }
  } catch (e) {
    return { ok: false, status: 0, body: (e as Error).message }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const period = (searchParams.get('period') || 'month').toLowerCase()
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined

  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }
  if (!accountId) {
    return NextResponse.json({ success: false, message: 'accountId is required' }, { status: 400 })
  }

  try {
    // Verify account and get password
    const mt5 = await prisma.mT5Account.findFirst({
      where: { userId: session.userId, accountId: String(accountId) },
      select: { accountId: true, password: true },
    })
    if (!mt5 || !mt5.password) {
      return NextResponse.json({ success: false, message: 'MT5 account not found or password not set' }, { status: 400 })
    }

    const API_BASE = (process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api').replace(/\/$/, '')

    // Login to get access token
    const loginRes = await tryFetch(`${API_BASE}/client/ClientAuth/login`, {
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
      return NextResponse.json({ success: false, message: `Login failed: ${loginRes.status}` }, { status: 502 })
    }
    const loginBody = loginRes.body as any
    const token = loginBody?.accessToken || loginBody?.AccessToken || loginBody?.Token || loginBody?.data?.accessToken
    if (!token) {
      return NextResponse.json({ success: false, message: 'No access token received' }, { status: 502 })
    }

    // New history endpoint: GET /client/ClientTradeHistory/trades
    const wantAll = searchParams.get('all') === 'true'
    const firstPage = Number(searchParams.get('page') || '1') || 1
    const pageSize = Number(searchParams.get('pageSize') || '200') || 200
    const base = `${API_BASE}/client/ClientTradeHistory/trades?accountId=${encodeURIComponent(mt5.accountId)}`
    const init: RequestInit = { method: 'GET', headers: { Authorization: `Bearer ${token}` } }

    const fetchPage = async (page: number) => {
      const url = `${base}&page=${page}&pageSize=${pageSize}`
      const r = await tryFetch(url, init)
      if (!r.ok) return r as any
      const body: any = (r as any).body
      let items: any[] = []
      if (Array.isArray(body)) items = body
      else if (Array.isArray(body?.items)) items = body.items
      else if (Array.isArray(body?.Items)) items = body.Items
      else if (Array.isArray(body?.data?.items)) items = body.data.items
      else if (Array.isArray(body?.data?.Items)) items = body.data.Items
      return { ok: true, status: 200, body, items }
    }

    if (!wantAll) {
      const resp = await fetchPage(firstPage)
      if (!resp?.ok) {
        return NextResponse.json({ success: false, message: `History fetch failed: ${resp?.status}`, details: (resp as any)?.body }, { status: 502 })
      }
      return NextResponse.json({ success: true, data: (resp as any).body })
    }

    // Aggregate across pages until fewer than pageSize items are returned
    let page = firstPage
    const aggregated: any[] = []
    let lastResp: any = null
    for (let i = 0; i < 50; i++) {
      const resp = await fetchPage(page)
      if (!resp?.ok) {
        return NextResponse.json({ success: false, message: `History fetch failed: ${resp?.status}`, details: (resp as any)?.body }, { status: 502 })
      }
      lastResp = (resp as any).body
      const items = (resp as any).items || []
      aggregated.push(...items)
      if (items.length < pageSize) break
      page += 1
    }
    return NextResponse.json({ success: true, data: aggregated })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}
