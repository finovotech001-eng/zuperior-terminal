import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

const API_BASE = (process.env.LIVE_API_URL || 'http://18.130.5.209:5003/api').replace(/\/$/, '')

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const merged = { ...(body || {}), ...(body?.order || {}) }
    const accountId = merged.accountId ?? merged.AccountId ?? merged.Login ?? merged.login
    const positionId = merged.positionId ?? merged.PositionId ?? merged.ticket ?? merged.Ticket ?? merged.position ?? merged.Position
    const stopLoss = merged.stopLoss ?? merged.StopLoss
    const takeProfit = merged.takeProfit ?? merged.TakeProfit
    const comment = merged.comment ?? merged.Comment

    if (!accountId || !positionId) {
      return NextResponse.json({ success: false, message: 'accountId and positionId are required' }, { status: 400 })
    }

    // Verify ownership and get password for token
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
      const errText = await loginRes.text().catch(() => '')
      return NextResponse.json({ success: false, message: `Login failed: ${errText || loginRes.status}` }, { status: 502 })
    }
    const loginJson = await loginRes.json().catch(() => ({} as any))
    const token = loginJson?.accessToken || loginJson?.AccessToken || loginJson?.Token || loginJson?.data?.accessToken
    if (!token) {
      return NextResponse.json({ success: false, message: 'No access token received' }, { status: 502 })
    }

    // Build payload for upstream
    const payload: any = {
      Login: parseInt(String(mt5.accountId), 10),
      PositionId: Number(positionId),
      Comment: typeof comment === 'string' ? comment : 'Modified via web terminal',
    }
    if (stopLoss !== undefined && stopLoss !== null && Number(stopLoss) > 0) payload.StopLoss = Number(stopLoss)
    if (takeProfit !== undefined && takeProfit !== null && Number(takeProfit) > 0) payload.TakeProfit = Number(takeProfit)

    const url = `${API_BASE}/Trading/position/modify`
    const upstream = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const text = await upstream.text().catch(() => '')
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    const debug = { url, payload, status: upstream.status }
    const resp = (data && typeof data === 'object') ? { ...data, debug } : { success: upstream.ok, data, debug }
    return NextResponse.json(resp, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}
