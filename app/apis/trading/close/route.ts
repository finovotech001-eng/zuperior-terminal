import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // 1. Check session
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request body
    const body = await request.json().catch(() => ({} as any))
    const accountId = body.accountId ?? body.AccountId ?? body.login ?? body.Login
    // Accept multiple id aliases from client: positionId, PositionId, ticket, Ticket, orderId, OrderId
    const rawId = body.positionId ?? body.PositionId ?? body.ticket ?? body.Ticket ?? body.orderId ?? body.OrderId
    const positionId = Number(rawId)
    const volume = Number(body.volume ?? 0)
    const accessTokenFromClient = body.accessToken ?? body.token ?? body.Token
    
    if (!accountId || !positionId) {
      return NextResponse.json({ 
        success: false, 
        message: 'accountId and positionId are required' 
      }, { status: 400 })
    }

    // 3. Get MT5 account credentials (or use provided token)
    let token: string | null = null
    if (typeof accessTokenFromClient === 'string' && accessTokenFromClient.length > 10) {
      token = accessTokenFromClient
    }
    let mt5: { accountId: string; password: string | null } | null = null
    if (!token) {
      // Strict ownership lookup
      mt5 = await prisma.mT5Account.findFirst({
        where: { userId: session.userId, accountId: String(accountId) },
        select: { accountId: true, password: true },
      })
      // Fallback: lookup by accountId only
      if (!mt5) {
        mt5 = await prisma.mT5Account.findFirst({
          where: { accountId: String(accountId) },
          select: { accountId: true, password: true },
        })
      }
    }
    
    if (!token && (!mt5 || !mt5.password)) {
      return NextResponse.json({ 
        success: false, 
        message: 'MT5 account not found' 
      }, { status: 400 })
    }

    // 4. Ensure external API base and get token if needed
    const RAW_API_BASE = (process.env.LIVE_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://18.175.242.21:5003').replace(/\/$/, '')
    const API_BASE = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : `${RAW_API_BASE}/api`
    
    if (!token) {
      const loginRes = await fetch(`${API_BASE}/client/ClientAuth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          AccountId: parseInt((mt5 as any).accountId, 10),
          Password: (mt5 as any).password,
          DeviceId: `web_${session.userId}`,
          DeviceType: 'web',
        }),
      })

      if (!loginRes.ok) {
        const t = await loginRes.text().catch(() => '')
        logger?.error?.('Close: MT5 login failed', { status: loginRes.status, body: t?.slice?.(0, 300) })
        return NextResponse.json({ 
          success: false, 
          message: 'MT5 login failed' 
        }, { status: 502 })
      }

      const loginData = await loginRes.json().catch(() => ({} as any))
      token = loginData?.accessToken || loginData?.AccessToken || loginData?.Token

      if (!token) {
        return NextResponse.json({ 
          success: false, 
          message: 'No access token received' 
        }, { status: 502 })
      }
    }

    // 5. Call DELETE /client/position/{positionId}
    if (!Number.isFinite(positionId) || positionId <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid positionId or ticket' }, { status: 400 })
    }

    // Helper to fetch with timeout and parse
    const doFetch = async (u: string, init: RequestInit, timeoutMs = 30000) => {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      let res: Response
      let text = ''
      try {
        res = await fetch(u, { ...init, signal: ctrl.signal })
        text = await res.text().catch(() => '')
      } finally {
        clearTimeout(t)
      }
      let json: any = null
      try { json = text ? JSON.parse(text) : null } catch { json = text }
      return { res, json }
    }

    // Primary: DELETE path param. If partial close, prefer query param to avoid DELETE body 415.
    const hasVolume = Number(volume) > 0
    const q = new URLSearchParams()
    if (hasVolume) q.set('volume', String(volume))
    const primaryUrl = `${API_BASE}/client/position/${positionId}${q.toString() ? `?${q.toString()}` : ''}`
    const baseHeaders: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      ...(accountId ? { 'AccountId': String(accountId) } : {}),
      'Accept': 'application/json',
    }
    const primary = await doFetch(primaryUrl, { method: 'DELETE', headers: baseHeaders })

    // Fallback 1: POST /client/position/close with JSON payload
    const shouldFallback1 = !primary.res.ok && (primary.res.status === 415 || primary.res.status === 405)
    let fallback1: { res: Response; json: any } | null = null
    if (shouldFallback1) {
      const payload: any = { positionId: Number(positionId) }
      if (hasVolume) payload.volume = Number(volume)
      const f1Url = `${API_BASE}/client/position/close`
      fallback1 = await doFetch(f1Url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...baseHeaders },
        body: JSON.stringify(payload),
      })
    }

    // Fallback 2: POST Trading/position/close with PascalCase payload
    const shouldFallback2 = (!primary.res.ok && !fallback1?.res.ok) && (primary.res.status === 415 || primary.res.status === 405 || (fallback1 && (fallback1.res.status === 415 || fallback1.res.status === 405)))
    let fallback2: { res: Response; json: any } | null = null
    if (shouldFallback2) {
      const payload: any = { Login: parseInt(String(accountId), 10), PositionId: Number(positionId) }
      if (hasVolume) payload.Volume = Number(volume)
      const f2Url = `${API_BASE}/Trading/position/close`
      fallback2 = await doFetch(f2Url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...baseHeaders },
        body: JSON.stringify(payload),
      })
    }

    const final = fallback2 ?? fallback1 ?? primary
    if (final.res.ok || final.res.status === 204) {
      return NextResponse.json({ success: true, data: final.json, message: 'Position closed successfully' }, { status: final.res.status })
    }
    const debug = {
      primary: { url: primaryUrl, status: primary.res.status, response: primary.json },
      ...(fallback1 ? { fallback1: { url: `${API_BASE}/client/position/close`, status: fallback1.res.status, response: fallback1.json } } : {}),
      ...(fallback2 ? { fallback2: { url: `${API_BASE}/Trading/position/close`, status: fallback2.res.status, response: fallback2.json } } : {}),
    }
    logger?.error?.('Close: all attempts failed', debug)
    return NextResponse.json({ success: false, message: (final.json && (final.json.message || final.json.error)) || 'Failed to close position', error: final.json, debug }, { status: final.res.status })

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}
