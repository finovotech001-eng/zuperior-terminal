import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(_request: NextRequest) {
  try {
    // Get user session
    const session = await getSession();

    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Get user ID from session
    const userId = session.userId;

    // Find all MT5 accounts for the user
    const mt5Accounts = await prisma.mT5Account.findMany({
      where: { userId: userId },
      select: {
        id: true,
        accountId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc' // Oldest first, so first created is default
      }
    });

    if (mt5Accounts.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No MT5 accounts found for this user.' },
        { status: 404 }
      );
    }

    // Find default account for user (if any). Guard for cases where
    // Prisma Client hasn't been regenerated yet and model isn't present.
    let defaultRow: { mt5AccountId: string } | null = null;
    const anyPrisma = prisma as any;
    if (anyPrisma?.defaultMT5Account?.findUnique) {
      try {
        defaultRow = await anyPrisma.defaultMT5Account.findUnique({
          where: { userId },
          select: { mt5AccountId: true },
        });
      } catch {
        defaultRow = null;
      }
    }

    // Format accounts with # prefix and return all
    const formattedAccounts = mt5Accounts.map(account => ({
      id: account.id,
      accountId: account.accountId,
      displayAccountId: `#${account.accountId}`,
      linkedAt: account.createdAt
    }));

    // Determine default: DB default if exists; fallback to first
    const fallbackDefault = formattedAccounts[0]?.accountId;
    const defaultAccountId = defaultRow?.mt5AccountId || fallbackDefault;

    // Return all MT5 accounts
    return NextResponse.json(
      {
        success: true,
        data: {
          accounts: formattedAccounts,
          defaultAccountId,
          totalAccounts: formattedAccounts.length
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Get MT5 Account API Error:', error);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
