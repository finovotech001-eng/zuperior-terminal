import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { setSession } from '@/lib/session';

/**
 * SSO Login endpoint
 * Accepts a token and clientId from the main CRM app and logs the user into the terminal
 */
export async function POST(request: NextRequest) {
  try {
    const { token, clientId } = await request.json();

    // Validate input
    if (!token || !clientId) {
      return NextResponse.json(
        { success: false, message: 'Token and clientId are required.' },
        { status: 400 }
      );
    }

    // Find user by clientId
    const user = await prisma.user.findUnique({
      where: { clientId: clientId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found.' },
        { status: 404 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: `Account is ${user.status}. Please contact support.` },
        { status: 403 }
      );
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token for terminal
    const terminalToken = generateToken({
      userId: user.id,
      email: user.email,
      clientId: user.clientId,
    });

    // Get user's MT5 account
    const mt5Account = await prisma.mT5Account.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        accountId: true,
      }
    });

    // Set session cookie
    await setSession(terminalToken);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'SSO login successful.',
        user: {
          id: user.id,
          clientId: user.clientId,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
        },
        mt5Account: mt5Account ? {
          id: mt5Account.id,
          accountId: mt5Account.accountId,
        } : null,
        token: terminalToken,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('SSO Login API Error:', error);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

