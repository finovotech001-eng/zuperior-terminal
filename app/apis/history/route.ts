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

    const API_BASE = (process.env.LIVE_API_URL || 'http://18.130.5.209:5003/api').replace(/\/$/, '')

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

    // Resolve endpoint based on period
    // Default to combined
    let path = '/client/OrdersAndDeals/combined'
    let init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ login: parseInt(mt5.accountId, 10), period, from, to }),
    }

    if (period === 'today') {
      path = '/client/OrdersAndDeals/today'
      init = { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    } else if (period === 'week') {
      path = '/client/OrdersAndDeals/recent?hoursBack=168'
      init = { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    } else if (period === 'month') {
      path = '/client/OrdersAndDeals/recent?hoursBack=720'
      init = { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    } else if (period === 'custom') {
      // keep combined with dates
      path = '/client/OrdersAndDeals/combined'
    }

    // Primary attempt
    let resp = await tryFetch(`${API_BASE}${path}&login=${encodeURIComponent(mt5.accountId)}`, init)
    // Fallbacks without /client prefix or without query login
    if (!resp.ok) resp = await tryFetch(`${API_BASE}${path.replace('/client', '')}&login=${encodeURIComponent(mt5.accountId)}`, init)
    if (!resp.ok) resp = await tryFetch(`${API_BASE}${path.replace('/client', '')}`, init)

    if (!resp.ok) {
      return NextResponse.json({ success: false, message: `History fetch failed: ${resp.status}`, details: resp.body }, { status: 502 })
    }

    return NextResponse.json({ success: true, data: resp.body })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}

