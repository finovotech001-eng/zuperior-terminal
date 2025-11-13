import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// Always ensure trailing /api in API_BASE
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.LIVE_API_URL || 'https://metaapi.zuperior.com/api'
const API_BASE = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : RAW_API_BASE.replace(/\/$/, '') + '/api'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const merged = { ...(body || {}), ...(body?.order || {}) }
    const accountId = merged.accountId ?? merged.AccountId ?? merged.Login ?? merged.login
    const symbol = merged.symbol ?? merged.Symbol
    const orderType = merged.orderType ?? merged.OrderType
    const volume = merged.volume ?? merged.Volume
    const price = merged.price ?? merged.Price
    const stopLoss = merged.stopLoss ?? merged.StopLoss
    const takeProfit = merged.takeProfit ?? merged.TakeProfit
    const expiration = merged.expiration ?? merged.Expiration
    const comment = merged.comment ?? merged.Comment
    const accessTokenFromClient = merged.accessToken ?? merged.token ?? merged.Token

    if (!accountId || !symbol || orderType === undefined || !volume || !price) {
      return NextResponse.json({ 
        success: false, 
        message: 'accountId, symbol, orderType, volume, and price are required' 
      }, { status: 400 })
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

    // Build payload for upstream client endpoint
    const payload: any = {
      Login: parseInt(String(accountId), 10),
      Symbol: String(symbol),
      OrderType: Number(orderType),
      Volume: Number(volume),
      Price: Number(price),
    }
    if (stopLoss !== undefined && stopLoss !== null && Number(stopLoss) > 0) payload.StopLoss = Number(stopLoss)
    if (takeProfit !== undefined && takeProfit !== null && Number(takeProfit) > 0) payload.TakeProfit = Number(takeProfit)
    if (expiration) payload.Expiration = expiration
    if (comment) payload.Comment = String(comment)

    try { console.log('[pending-order] request payload', { accountId, payload, useClientToken: !!accessTokenFromClient }) } catch {}

    // Call the API endpoint
    const upstreamUrl = `${API_BASE}/client/pending-order`
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(payload),
    })

    const responseText = await upstreamRes.text().catch(() => '')
    let responseData: any = null
    try { responseData = responseText ? JSON.parse(responseText) : null } catch { responseData = responseText }

    try { console.log('[pending-order] upstream response', { status: upstreamRes.status, data: responseData }) } catch {}

    if (upstreamRes.ok) {
      return NextResponse.json({ 
        success: true, 
        data: responseData 
      }, { status: upstreamRes.status })
    }

    return NextResponse.json({ 
      success: false, 
      message: responseData?.message || responseData?.error || 'Failed to place pending order',
      error: responseData 
    }, { status: upstreamRes.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}

