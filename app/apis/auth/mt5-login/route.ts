import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

/**
 * MT5 Client Authentication API
 * Authenticates with the MT5 API to get access token for SignalR connection
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getSession();

    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Get the account ID from request body
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Get MT5 account credentials from database
    const mt5Account = await prisma.mT5Account.findFirst({
      where: {
        accountId: accountId,
        userId: session.userId
      },
      select: {
        accountId: true,
        password: true
      }
    });

    if (!mt5Account) {
      return NextResponse.json(
        { success: false, message: 'MT5 account not found or access denied' },
        { status: 404 }
      );
    }

    if (!mt5Account.password) {
      return NextResponse.json(
        { success: false, message: 'MT5 account password not configured' },
        { status: 400 }
      );
    }

    // Call the MT5 ClientAuth/login API
    const MT5_API_URL = process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api';
    const loginUrl = `${MT5_API_URL}/client/ClientAuth/login`;

    const loginPayload = {
      AccountId: parseInt(mt5Account.accountId),
      Password: mt5Account.password,
      DeviceId: `mobile_device_${session.userId}`,
      DeviceType: "mobile",
    };

    console.log(`🔐 Authenticating MT5 account: ${accountId}`);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }));
      console.error('MT5 authentication failed:', errorData);
      return NextResponse.json(
        { 
          success: false, 
          message: errorData.error || 'Failed to authenticate with MT5 server' 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const accessToken =
      data?.accessToken ||
      data?.AccessToken ||
      data?.token ||
      data?.Token ||
      data?.data?.accessToken ||
      data?.Data?.AccessToken ||
      data?.Result?.AccessToken ||
      null;

    if (!accessToken) {
      console.error('MT5 login response did not include access token. Raw:', data);
      return NextResponse.json(
        { success: false, message: 'No access token received from MT5 server' },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully authenticated MT5 account: ${accountId}`);

    // Return the access token and account info
    return NextResponse.json(
      {
        success: true,
        data: {
          accessToken,
          accountId: mt5Account.accountId,
          expiresIn: data.expiresIn || 3600
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('MT5 Login API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'An internal server error occurred.' 
      },
      { status: 500 }
    );
  }
}


