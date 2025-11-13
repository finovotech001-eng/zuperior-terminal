import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In-memory client token cache
type TokenEntry = { token: string; accountId: string; exp: number }
const __chartTokenCache = ((global as any).__chartTokenCache ||= new Map<string, TokenEntry>()) as Map<string, TokenEntry>

// Build external API base from envs and ensure "/api" suffix
const RAW_BASE = (process.env.MT5_API_BASE || process.env.LIVE_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://metaapi.zuperior.com').replace(/\/$/, '')
const API_BASE = RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE}/api`

function buildUrl(symbol: string, timeframe: string) {
  return `${API_BASE}/chart/candle/current/${symbol}?timeframe=${timeframe}`
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await context.params
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '1'
    const accountId = searchParams.get('accountId')

    // Obtain access token
    let token: string | null = null
    let verifiedAccountId: string | null = null
    try {
      const session = await getSession()
      if (session?.userId) {
        let acct: { accountId: string; password: string | null } | null = null
        if (accountId) {
          acct = await prisma.mT5Account.findFirst({ where: { userId: session.userId, accountId: String(accountId) }, select: { accountId: true, password: true } })
            || await prisma.mT5Account.findFirst({ where: { accountId: String(accountId) }, select: { accountId: true, password: true } })
        } else {
          acct = await prisma.mT5Account.findFirst({ where: { userId: session.userId }, select: { accountId: true, password: true } })
        }
        if (acct?.password) {
          const cacheKey = acct.accountId
          const now = Date.now()
          const cached = __chartTokenCache.get(cacheKey)
          if (cached && cached.exp > now) {
            token = cached.token
            verifiedAccountId = cached.accountId
          } else {
            const loginRes = await fetch(`${API_BASE}/client/ClientAuth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ AccountId: parseInt(acct.accountId, 10), Password: acct.password, DeviceId: `web_chart_${Date.now()}`, DeviceType: 'web' }) })
            if (loginRes.ok) {
              const loginJson = await loginRes.json().catch(() => ({} as any))
              token = loginJson?.accessToken || loginJson?.AccessToken || loginJson?.Token || null
              verifiedAccountId = acct.accountId
              if (token) __chartTokenCache.set(cacheKey, { token, accountId: acct.accountId, exp: now + 50 * 60 * 1000 })
            }
          }
        }
      }
    } catch {}

    // Try symbol as-is, then toggle micro suffix 'm'
    const candidates: string[] = [symbol]
    if (/m$/i.test(symbol)) candidates.push(symbol.slice(0, -1))
    else candidates.push(symbol + 'm')

    let data: any = null
    let lastStatus = 0
    for (const s of candidates) {
      const url = buildUrl(s, timeframe)
      const headers: Record<string, string> = { 'Accept': 'application/json' }
      if (token && verifiedAccountId) {
        headers['Authorization'] = `Bearer ${token}`
        headers['AccountId'] = String(verifiedAccountId)
      }
      const response = await fetch(url, { method: 'GET', headers, cache: 'no-store' })
      lastStatus = response.status
      if (response.ok) {
        data = await response.json().catch(() => null)
        if (data) break
      }
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to fetch current candle', status: lastStatus }, { status: 502 })
    }
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Chart current API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch current candle' },
      { status: 500 }
    )
  }
}
