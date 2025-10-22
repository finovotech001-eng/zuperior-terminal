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

    // Format accounts with # prefix and return all
    const formattedAccounts = mt5Accounts.map(account => ({
      id: account.id,
      accountId: account.accountId,
      displayAccountId: `#${account.accountId}`,
      linkedAt: account.createdAt
    }));

    // Return all MT5 accounts
    return NextResponse.json(
      {
        success: true,
        data: {
          accounts: formattedAccounts,
          defaultAccountId: formattedAccounts[0].accountId, // First account as default
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