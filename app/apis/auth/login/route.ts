import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePassword, generateToken, isValidEmail } from '@/lib/auth';
import { setSession } from '@/lib/session';
import { ensureDefaultFavorites } from '@/lib/default-favorites';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format.' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: `Account is ${user.status}. Please contact support.` },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = generateToken({
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
    await setSession(token);

    // Ensure user has default favorites (async, don't wait)
    ensureDefaultFavorites(user.id).catch(err => {
      console.error('Failed to add default favorites:', err);
    });

    // Return success response with MT5 account info
    return NextResponse.json(
      {
        success: true,
        message: 'Login successful.',
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
        token,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

