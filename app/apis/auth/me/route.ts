import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get current session
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated.' },
        { status: 401 }
      );
    }

    // Fetch user details from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        clientId: true,
        email: true,
        name: true,
        phone: true,
        country: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found.' },
        { status: 404 }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: `Account is ${user.status}.` },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get Current User API Error:', error);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

