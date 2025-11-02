import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

const API_BASE = (process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api').replace(/\/$/, '')

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId') || ''
    if (!accountId) {
      return NextResponse.json({ success: false, message: 'Missing accountId' }, { status: 400 })
    }

    // Get account to retrieve password for login
    const mt5 = await prisma.mT5Account.findFirst({
      where: { userId: session.userId, accountId: String(accountId) },
      select: { accountId: true, password: true },
    })
    if (!mt5 || !mt5.password) {
      return NextResponse.json({ success: false, message: 'MT5 account not found or password not set' }, { status: 400 })
    }

    // Login to get token
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

    // Fetch symbols
    const symRes = await fetch(`${API_BASE}/Symbols`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const text = await symRes.text().catch(() => '')
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { json = text }

    // Normalize to an array of strings for easy inspection
    const list: any[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : [])
    const names = list.map((it: any) => String(it?.Symbol ?? it?.symbol ?? it?.Name ?? it?.name ?? it?.Code ?? it?.code ?? '')).filter(Boolean)

    return NextResponse.json({ success: true, count: names.length, symbols: names.slice(0, 500) })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}

