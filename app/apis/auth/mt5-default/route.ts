import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// GET: return current user's default MT5 accountId
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const row = await prisma.defaultMT5Account.findUnique({
      where: { userId: session.userId },
      select: { mt5AccountId: true },
    })

    return NextResponse.json({ success: true, data: { accountId: row?.mt5AccountId || null } })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

// POST: set default MT5 account for current user
// body: { accountId: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { accountId } = await request.json()
    if (!accountId) {
      return NextResponse.json({ success: false, message: 'accountId is required' }, { status: 400 })
    }

    // Verify the account belongs to the user
    const mt5 = await prisma.mT5Account.findFirst({
      where: { userId: session.userId, accountId: String(accountId) },
      select: { accountId: true },
    })
    if (!mt5) {
      return NextResponse.json({ success: false, message: 'Account not found' }, { status: 404 })
    }

    // Upsert default
    await prisma.defaultMT5Account.upsert({
      where: { userId: session.userId },
      update: { mt5AccountId: mt5.accountId },
      create: { 
        id: crypto.randomUUID(),
        userId: session.userId, 
        mt5AccountId: mt5.accountId 
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

