import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const { accountId, positionId, Volume, Price, Comment } = body || {}
    if (!accountId || !positionId) {
      return NextResponse.json({ success: false, message: 'accountId and positionId are required' }, { status: 400 })
    }

    // Verify account belongs to user
    const mt5 = await prisma.mT5Account.findFirst({
      where: { userId: session.userId, accountId: String(accountId) },
      select: { accountId: true, password: true },
    })
    if (!mt5 || !mt5.password) {
      return NextResponse.json({ success: false, message: 'MT5 account not found or password not set' }, { status: 400 })
    }

    // Get token directly from LIVE_API_URL
    const API_BASE = (process.env.LIVE_API_URL || 'http://18.130.5.209:5003/api').replace(/\/$/, '')
    const loginUrl = `${API_BASE}/client/ClientAuth/login`
    const loginRes = await fetch(loginUrl, {
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
      const err = await loginRes.text().catch(() => '')
      return NextResponse.json({ success: false, message: `Login failed: ${err || loginRes.status}` }, { status: 502 })
    }
    const loginJson = await loginRes.json().catch(() => ({} as any))
    const token = loginJson?.accessToken || loginJson?.AccessToken || loginJson?.Token || loginJson?.data?.accessToken
    if (!token) {
      return NextResponse.json({ success: false, message: 'No access token received' }, { status: 502 })
    }

    // Call upstream DELETE /client/position/{positionId}
    const url = `${API_BASE}/client/position/${encodeURIComponent(positionId)}`
    const payload: any = {}
    if (Volume !== undefined) payload.Volume = Volume
    if (Price !== undefined) payload.Price = Price
    if (Comment !== undefined) payload.Comment = Comment

    const upstream = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    // Some upstreams return 204 No Content on success
    let data: any = null
    const text = await upstream.text().catch(() => '')
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text || null
    }
    if (upstream.ok) {
      return NextResponse.json(data ?? { success: true }, { status: upstream.status })
    }
    return NextResponse.json({ success: false, error: data || 'Close failed' }, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}
