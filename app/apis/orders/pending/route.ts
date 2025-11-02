import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// Always ensure trailing /api in API_BASE
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api'
const API_BASE = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : RAW_API_BASE.replace(/\/$/, '') + '/api'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const accessTokenFromClient = searchParams.get('accessToken')

    if (!accountId) {
      return NextResponse.json({ success: false, message: 'accountId is required' }, { status: 400 })
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

    // Call the API endpoint with Bearer token
    const upstreamUrl = `${API_BASE}/client/orders`
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
    })

    const responseText = await upstreamRes.text().catch(() => '')
    let responseData: any = null
    try { responseData = responseText ? JSON.parse(responseText) : null } catch { responseData = responseText }

    try { console.log('[orders/pending] upstream response', { status: upstreamRes.status, data: responseData }) } catch {}

    if (upstreamRes.ok) {
      return NextResponse.json({ 
        success: true, 
        data: responseData 
      }, { status: upstreamRes.status })
    }

    return NextResponse.json({ 
      success: false, 
      message: responseData?.message || responseData?.error || 'Failed to fetch pending orders',
      error: responseData 
    }, { status: upstreamRes.status })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 })
  }
}

