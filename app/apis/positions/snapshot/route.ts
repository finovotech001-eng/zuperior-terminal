import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import * as signalR from '@microsoft/signalr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const debug = searchParams.get('debug') === '1'
  const passwordOverride = searchParams.get('password') || searchParams.get('mt5Password')

  if (!accountId) {
    return NextResponse.json({ success: false, message: 'accountId is required' }, { status: 400 })
  }

  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let connection: signalR.HubConnection | null = null
  let stage = 'init'
  try {
    // Lookup MT5 credentials
    stage = 'db:lookup'
    // Fetch MT5 credentials strictly by accountId (independent of user)
    const mt5 = await prisma.mT5Account.findFirst({
      where: { accountId: String(accountId) },
      select: { accountId: true, password: true },
    })
    if (!mt5 && !passwordOverride) {
      return NextResponse.json({ success: false, message: 'MT5 account not found' }, { status: 400 })
    }
    const mt5Password = passwordOverride || mt5?.password
    if (!mt5Password) {
      return NextResponse.json({ success: false, message: 'MT5 account password not configured' }, { status: 400 })
    }

    // Authenticate
    stage = 'auth:login'
    const MT5_API_URL = process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api'
    const loginUrl = `${MT5_API_URL}/client/ClientAuth/login`
    const payload = {
      AccountId: parseInt(mt5.accountId, 10),
      Password: mt5Password,
      DeviceId: `mobile_device_${session.userId}`,
      DeviceType: 'mobile',
    }
    const loginRes = await fetch(loginUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!loginRes.ok) {
      const txt = await loginRes.text().catch(() => '')
      return NextResponse.json({ success: false, message: `MT5 login failed: ${txt || loginRes.status}` }, { status: 502 })
    }
    const loginData = await loginRes.json().catch(() => ({} as any))
    const token = loginData?.accessToken || loginData?.AccessToken || loginData?.Token || loginData?.data?.accessToken
    if (!token) {
      return NextResponse.json({ success: false, message: 'No access token received from MT5 server' }, { status: 502 })
    }

    // Connect to hub (server-side; headers allowed)
    stage = 'hub:connect'
    const HUB_BASE = process.env.TRADING_HUB_URL || 'http://18.175.242.21:5003/hubs/mobiletrading'
    const qp = new URLSearchParams({
      accountId: mt5.accountId,
      clientVersion: '1.0.0',
      clientPlatform: 'ReactNative',
      deviceId: `server-${session.userId}`,
    }).toString()
    const hubUrl = `${HUB_BASE}?${qp}`
    connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        // Use LongPolling on server to avoid Node WebSocket dependency
        transport: signalR.HttpTransportType.LongPolling,
        withCredentials: false,
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    await connection.start()

    // Try to select account
    stage = 'hub:select-account'
    const tryInvoke = async (...candidates: Array<string | [string, ...any[]]>) => {
      for (const c of candidates) {
        try {
          if (Array.isArray(c)) {
            // @ts-ignore
            await connection!.invoke(c[0], ...c.slice(1))
          } else {
            // @ts-ignore
            await connection!.invoke(c)
          }
          return true
        } catch {}
      }
      return false
    }

    await tryInvoke(['SetAccountId', mt5.accountId], ['SelectAccount', mt5.accountId], ['SetLogin', parseInt(mt5.accountId, 10)], ['SetLogin', mt5.accountId])

    // Try to fetch snapshot with common method names
    const invokeWithResult = async (...candidates: Array<string | [string, ...any[]]>) => {
      for (const c of candidates) {
        try {
          let res: any
          if (Array.isArray(c)) {
            // @ts-ignore
            res = await connection!.invoke(c[0], ...c.slice(1))
          } else {
            // @ts-ignore
            res = await connection!.invoke(c)
          }
          return res
        } catch {}
      }
      return null
    }

    // First, try to subscribe and wait briefly for a pushed update
    stage = 'hub:subscribe'
    let pushed: any = null
    const forward = (data: any) => { pushed = data }
    connection.on('positions', forward)
    connection.on('Positions', forward)
    connection.on('PositionsUpdate', forward)
    connection.on('PositionUpdate', forward)
    
    await tryInvoke(
      'SubscribeToPositions',
      'SubscribePositions',
      'Subscribe',
      ['SubscribePositionsForAccount', mt5.accountId],
      ['SubscribeToPositions', mt5.accountId],
      ['SubscribeToPositionsForLogin', parseInt(mt5.accountId, 10)],
      ['SubscribePositionsByLogin', parseInt(mt5.accountId, 10)],
    )
    
    // Give up to 1200ms for a push
    await new Promise(res => setTimeout(res, 1200))

    // If nothing pushed, fall back to invoke methods
    stage = 'hub:get-positions'
    const result = pushed ?? await invokeWithResult(
      'GetPositions',
      'GetOpenPositions',
      'Positions',
      ['GetPositionsByLogin', parseInt(mt5.accountId, 10)],
      ['GetPositionsByLoginEx', parseInt(mt5.accountId, 10)],
      ['GetPositionsByAccount', mt5.accountId],
      ['GetAccountPositions', mt5.accountId],
      'GetPositionsList',
      'OpenPositions',
      'GetTrades',
      'GetPositionsSnapshot',
      ['GetPositionsForAccount', mt5.accountId],
      ['GetPositions', mt5.accountId],
      ['GetPositions', parseInt(mt5.accountId, 10)],
    )

    await connection.stop().catch(() => {})
    connection = null

    return NextResponse.json({ success: true, data: result ?? [], debug: debug ? { stage, hubUrl, MT5_API_URL } : undefined })
  } catch (error) {
    if (connection) {
      try { await connection.stop() } catch {}
    }
    const msg = error instanceof Error ? error.message : 'Snapshot failed'
    console.error('[positions/snapshot] Error:', stage, msg)
    return NextResponse.json({ success: false, message: msg, stage }, { status: 500 })
  }
}
