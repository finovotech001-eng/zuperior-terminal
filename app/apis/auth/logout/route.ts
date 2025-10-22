import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function POST() {
  try {
    // Clear the session cookie
    await clearSession();

    return NextResponse.json(
      { success: true, message: 'Logout successful.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout API Error:', error);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}


