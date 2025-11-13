import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// Always ensure trailing /api in API_BASE
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.LIVE_API_URL || 'https://metaapi.zuperior.com/api';
const API_BASE = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : RAW_API_BASE.replace(/\/$/, '') + '/api';
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    const accessTokenFromClient = merged.accessToken ?? merged.token ?? merged.Token

    if (!accountId || !positionId) {
      return NextResponse.json({ success: false, message: 'accountId and positionId are required' }, { status: 400 })
    }

    // If client provided an access token, we can skip DB lookup/login
    let token: string | null = null
    if (typeof accessTokenFromClient === 'string' && accessTokenFromClient.length > 10) {
      token = accessTokenFromClient
    }

    // Otherwise, verify account and get password for token
    let mt5: { accountId: string; password: string | null } | null = null
    if (!token) {
      // Try strict ownership first
      mt5 = await prisma.mT5Account.findFirst({
        where: { userId: session.userId, accountId: String(accountId) },
        select: { accountId: true, password: true },
      })
      // Fallback: lookup by accountId only if not found
      if (!mt5) {
        mt5 = await prisma.mT5Account.findFirst({
          where: { accountId: String(accountId) },
          select: { accountId: true, password: true },
        })
      }
      if (!mt5 || !mt5.password) {
        return NextResponse.json({ success: false, message: 'MT5 account not found or password not set' }, { status: 400 })
      }
    }

    // Login to get token
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
        const errText = await loginRes.text().catch(() => '')
        return NextResponse.json({ success: false, message: `Login failed: ${errText || loginRes.status}` }, { status: 502 })
      }
      const loginJson = await loginRes.json().catch(() => ({} as any))
      token = loginJson?.accessToken || loginJson?.AccessToken || loginJson?.Token || loginJson?.data?.accessToken
      if (!token) {
        return NextResponse.json({ success: false, message: 'No access token received' }, { status: 502 })
      }
    }

    // Build payload for upstream client endpoint - match exact API format (positionId, stopLoss, takeProfit, comment only)
    const payload: any = {
      positionId: Number(positionId),
      comment: typeof comment === 'string' ? comment : 'Modified via web terminal',
    }
    if (stopLoss !== undefined && stopLoss !== null && Number(stopLoss) > 0) payload.stopLoss = Number(stopLoss)
    if (takeProfit !== undefined && takeProfit !== null && Number(takeProfit) > 0) payload.takeProfit = Number(takeProfit)
    try { console.log('[position/modify] request payload', { accountId, positionId, payload, useClientToken: !!accessTokenFromClient }) } catch {}

    // Helper to perform a fetch with timeout and parse
    const doFetch = async (u: string, init: RequestInit, timeoutMs: number) => {
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

    // Primary attempt: client endpoint
    const primaryUrl = `${API_BASE}/client/position/modify`
    const primary = await doFetch(primaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }, 35000)

    // Decide whether to fall back to Trading endpoint
    const shouldFallback = !primary.res.ok || primary.res.status === 408 || primary.res.status === 504
    let secondary: { res: Response; json: any } | null = null
    if (shouldFallback) {
      const tradingPayload: any = {
        Login: parseInt(String(accountId), 10),
        PositionId: Number(positionId),
        Comment: typeof comment === 'string' ? comment : 'Modified via web terminal',
      }
      if (stopLoss !== undefined && stopLoss !== null && Number(stopLoss) > 0) tradingPayload.StopLoss = Number(stopLoss)
      if (takeProfit !== undefined && takeProfit !== null && Number(takeProfit) > 0) tradingPayload.TakeProfit = Number(takeProfit)
      const secondaryUrl = `${API_BASE}/Trading/position/modify`
      secondary = await doFetch(secondaryUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(tradingPayload),
      }, 35000)
      const combined = {
        success: (primary.res.ok || (secondary?.res.ok ?? false)),
        primary: { status: primary.res.status, url: primaryUrl, request: payload, response: primary.json },
        secondary: { status: secondary.res.status, url: `${API_BASE}/Trading/position/modify`, request: tradingPayload, response: secondary.json },
      }
      try { console.log('[position/modify] combined result', JSON.stringify(combined)) } catch {}
      // Choose best response to forward
      const forward = secondary.res.ok ? secondary : primary
      return NextResponse.json({ success: forward.res.ok, data: forward.json, debug: combined }, { status: forward.res.status })
    }

    const debug = { url: primaryUrl, payload, status: primary.res.status }
    const resp = (primary.json && typeof primary.json === 'object') ? { ...primary.json, debug } : { success: primary.res.ok, data: primary.json, debug }
    try { console.log('[position/modify] upstream response', JSON.stringify(resp)) } catch {}
    return NextResponse.json(resp, { status: primary.res.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}

// Support POST as alias for PUT for client simplicity
export async function POST(request: NextRequest) {
  return PUT(request)
}
