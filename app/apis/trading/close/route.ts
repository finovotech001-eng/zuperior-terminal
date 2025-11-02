import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // 1. Check session
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request body
    const body = await request.json()
    const { accountId, positionId, volume = 0 } = body
    
    if (!accountId || !positionId) {
      return NextResponse.json({ 
        success: false, 
        message: 'accountId and positionId are required' 
      }, { status: 400 })
    }

    // 3. Get MT5 account credentials
    const mt5 = await prisma.mT5Account.findFirst({
      where: { 
        userId: session.userId, 
        accountId: String(accountId) 
      },
      select: { accountId: true, password: true },
    })
    
    if (!mt5 || !mt5.password) {
      return NextResponse.json({ 
        success: false, 
        message: 'MT5 account not found' 
      }, { status: 400 })
    }

    // 4. Login to get access token
    const API_BASE = (process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api').replace(/\/$/, '')
    
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
      return NextResponse.json({ 
        success: false, 
        message: 'MT5 login failed' 
      }, { status: 502 })
    }

    const loginData = await loginRes.json()
    const token = loginData?.accessToken || loginData?.AccessToken || loginData?.Token
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        message: 'No access token received' 
      }, { status: 502 })
    }

    // 5. Call DELETE /client/position/{positionId}
    const deleteRes = await fetch(`${API_BASE}/client/position/${positionId}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ volume: Number(volume) }),
    })

    const responseText = await deleteRes.text()
    let responseData: any = null
    
    try {
      responseData = responseText ? JSON.parse(responseText) : null
    } catch {
      responseData = responseText
    }

    if (deleteRes.ok || deleteRes.status === 204) {
      return NextResponse.json({ 
        success: true, 
        data: responseData,
        message: 'Position closed successfully' 
      })
    }

    return NextResponse.json({ 
      success: false, 
      message: responseData?.message || responseData?.error || 'Failed to close position',
      error: responseData 
    }, { status: deleteRes.status })

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}
