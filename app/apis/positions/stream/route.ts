import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import * as signalR from '@microsoft/signalr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function jsonEvent(data: any) {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const passwordOverride = searchParams.get('password') || searchParams.get('mt5Password')

  if (!accountId) {
    return NextResponse.json({ success: false, message: 'accountId is required' }, { status: 400 })
  }

  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Lookup MT5 credentials
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

    // Authenticate to MT5 API
    const MT5_API_URL = process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api'
    const loginUrl = `${MT5_API_URL}/client/ClientAuth/login`
    const payload = {
      AccountId: parseInt(mt5.accountId, 10),
      Password: mt5Password,
      DeviceId: `mobile_device_${session.userId}`,
      DeviceType: 'mobile',
    }

    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!loginRes.ok) {
      const txt = await loginRes.text().catch(() => '')
      return NextResponse.json({ success: false, message: `MT5 login failed: ${txt || loginRes.status}` }, { status: 502 })
    }
    const loginData = await loginRes.json().catch(() => ({} as any))
    const accessToken =
      loginData?.accessToken ||
      loginData?.AccessToken ||
      loginData?.token ||
      loginData?.Token ||
      loginData?.data?.accessToken ||
      loginData?.Data?.AccessToken ||
      loginData?.Result?.AccessToken ||
      null
    if (!accessToken) {
      return NextResponse.json({ success: false, message: 'No access token received from MT5 server' }, { status: 502 })
    }

    // Helper to attempt multiple hub method names (ignore return)
    const tryInvokeAny = async (conn: signalR.HubConnection, candidates: Array<string | [string, ...any[]]>) => {
      for (const c of candidates) {
        try {
          if (Array.isArray(c)) {
            const [name, ...args] = c
            // @ts-ignore
            await conn.invoke(name, ...args)
          } else {
            // @ts-ignore
            await conn.invoke(c)
          }
          return true
        } catch {
          // try next
        }
      }
      return false
    }

    // Helper to attempt multiple hub method names (return first successful result)
    const invokeFirstWithResult = async (conn: signalR.HubConnection, candidates: Array<string | [string, ...any[]]>) => {
      for (const c of candidates) {
        try {
          let res: any
          if (Array.isArray(c)) {
            const [name, ...args] = c
            // @ts-ignore
            res = await conn.invoke(name, ...args)
          } else {
            // @ts-ignore
            res = await conn.invoke(c)
          }
          return { ok: true, name: Array.isArray(c) ? c[0] : c, data: res }
        } catch {
          // continue
        }
      }
      return { ok: false, name: null as any, data: null as any }
    }

    // Helper to attempt multiple hub method names (return name only)
    const invokeFirst = async (conn: signalR.HubConnection, candidates: Array<string | [string, ...any[]]>) => {
      for (const c of candidates) {
        try {
          if (Array.isArray(c)) {
            const [name, ...args] = c
            // @ts-ignore
            await conn.invoke(name, ...args)
            return { ok: true, name }
          } else {
            // @ts-ignore
            await conn.invoke(c)
            return { ok: true, name: c }
          }
        } catch {
          // continue
        }
      }
      return { ok: false, name: null as any }
    }

    // Helper to estimate count in a result payload
    const estimateCount = (obj: any): number => {
      if (!obj) return 0
      if (Array.isArray(obj)) return obj.length
      // Account for envelope with { count, data: [...] }
      if (Array.isArray(obj.data)) return obj.data.length
      if (typeof obj.count === 'number' && obj.count > 0) return obj.count
      const nested = [obj.Positions, obj.positions, obj.Data, obj.data, obj.Result]
      for (const c of nested) {
        if (Array.isArray(c)) return c.length
        if (c && typeof c === 'object') {
          // one more level deep common case: { Data: { Positions: [...] } }
          const deeper = (c as any).Positions || (c as any).positions || (c as any).Items || (c as any).items
          if (Array.isArray(deeper)) return deeper.length
        }
      }
      return 0
    }

    // Create SSE stream
    let connection: signalR.HubConnection | null = null
    let timer: NodeJS.Timeout | null = null

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // SignalR connection from server (no CORS restrictions)
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
            accessTokenFactory: () => accessToken,
            // Use LongPolling to avoid Node WebSocket dependency
            transport: signalR.HttpTransportType.LongPolling,
            withCredentials: false,
          })
          .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 5000 })
          .configureLogging(signalR.LogLevel.Information)
          .build()

        // Unified handler to forward any positions payloads
        const forward = (label: string, data: any) => {
          const chunk = new TextEncoder().encode(jsonEvent({ type: 'positions', data }))
          controller.enqueue(chunk)
        }

        // Handlers (cover common server method names)
        connection.on('PositionUpdate', (data: any) => forward('PositionUpdate', data))
        connection.on('positions', (data: any) => forward('positions', data))
        connection.on('Positions', (data: any) => forward('Positions', data))
        connection.on('PositionsUpdate', (data: any) => forward('PositionsUpdate', data))
        connection.on('connected', (_: any) => {
          const chunk = new TextEncoder().encode(jsonEvent({ type: 'connected' }))
          controller.enqueue(chunk)
        })
        connection.on('PositionOpened', (data: any) => {
          const chunk = new TextEncoder().encode(jsonEvent({ type: 'opened', data }))
          controller.enqueue(chunk)
        })
        connection.on('PositionClosed', (data: any) => {
          const chunk = new TextEncoder().encode(jsonEvent({ type: 'closed', data }))
          controller.enqueue(chunk)
        })

        await connection.start()
        // Announce successful login/connect
        controller.enqueue(new TextEncoder().encode(jsonEvent({ type: 'debug', data: `login ok; account ${mt5.accountId}` })))

        // Some hubs require selecting the account/login explicitly
        const selected = await invokeFirst(connection, [
          ['SetAccountId', mt5.accountId],
          ['SelectAccount', mt5.accountId],
          ['SetLogin', parseInt(mt5.accountId, 10)],
          ['SetLogin', mt5.accountId],
        ])
        controller.enqueue(new TextEncoder().encode(jsonEvent({ type: 'debug', data: `select account via ${selected.ok ? selected.name : 'none'}` })))
        // Subscribe using best-guess method names
        const sub = await invokeFirst(connection, [
          'SubscribeToPositions',
          'SubscribePositions',
          'Subscribe',
          ['SubscribePositionsForAccount', mt5.accountId],
          ['SubscribeToPositions', mt5.accountId],
          ['SubscribeToPositionsForLogin', parseInt(mt5.accountId, 10)],
          ['SubscribeToPositionsForLogin', mt5.accountId],
          ['SubscribeForPositions', mt5.accountId],
          ['SubscribeAccountPositions', mt5.accountId],
          ['SubscribePositionsByLogin', parseInt(mt5.accountId, 10)],
        ])
        controller.enqueue(new TextEncoder().encode(jsonEvent({ type: 'debug', data: `subscribe via ${sub.ok ? sub.name : 'none'}` })))
        // Initial fetch using best-guess method names (capture result)
        // small settle delay after selecting account
        await new Promise(res => setTimeout(res, 150))

        const initial = await invokeFirstWithResult(connection, [
          'GetPositions',
          'GetOpenPositions',
          'Positions',
          ['GetPositionsByLogin', parseInt(mt5.accountId, 10)],
          ['GetPositionsByLoginEx', parseInt(mt5.accountId, 10)],
          ['GetPositionsByAccount', mt5.accountId],
          ['GetPositionsById', mt5.accountId],
          ['GetAccountPositions', mt5.accountId],
          'GetPositionsList',
          'OpenPositions',
          'GetTrades',
          'GetPositionsSnapshot',
          ['GetPositionsForAccount', mt5.accountId],
          ['GetPositions', mt5.accountId],
          ['GetPositions', parseInt(mt5.accountId, 10)],
        ])
        if (initial.ok) {
          const dbg = new TextEncoder().encode(jsonEvent({ type: 'debug', data: `fetched via ${initial.name}; count ${estimateCount(initial.data)}` }))
          controller.enqueue(dbg)
          const chunk = new TextEncoder().encode(jsonEvent({ type: 'positions', data: initial.data }))
          controller.enqueue(chunk)
        } else {
          const warn = new TextEncoder().encode(jsonEvent({ type: 'warn', data: 'No known GetPositions method succeeded' }))
          controller.enqueue(warn)
        }

        // Poll every ~300ms
        timer = setInterval(async () => {
          const polled = await invokeFirstWithResult(connection!, [
            'GetPositions',
            'GetOpenPositions',
            'Positions',
            ['GetPositionsByLogin', parseInt(mt5.accountId, 10)],
            ['GetPositionsByLoginEx', parseInt(mt5.accountId, 10)],
            ['GetPositionsByAccount', mt5.accountId],
            ['GetPositionsById', mt5.accountId],
            ['GetAccountPositions', mt5.accountId],
            'GetPositionsList',
            'OpenPositions',
            'GetTrades',
            'GetPositionsSnapshot',
            ['GetPositionsForAccount', mt5.accountId],
            ['GetPositions', mt5.accountId],
            ['GetPositions', parseInt(mt5.accountId, 10)],
          ])
          if (polled.ok) {
            controller.enqueue(new TextEncoder().encode(jsonEvent({ type: 'debug', data: `poll via ${polled.name}; count ${estimateCount(polled.data)}` })))
            const chunk = new TextEncoder().encode(jsonEvent({ type: 'positions', data: polled.data }))
            controller.enqueue(chunk)
          }
        }, 300)

        const hello = new TextEncoder().encode(jsonEvent({ type: 'ready' }))
        controller.enqueue(hello)
      },
      async cancel() {
        if (timer) clearInterval(timer)
        timer = null
        if (connection) {
          try { await connection.stop() } catch {}
          connection = null
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[positions/stream] Error:', msg)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
