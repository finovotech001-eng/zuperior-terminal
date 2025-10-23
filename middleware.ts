// middleware.ts (Edge runtime only)
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/apis/auth/login', // allow login
  '/apis/auth/register', // allow registration
  '/_next', '/favicon.ico'
];

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET || 'dev-secret'
);

async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // skip public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // get token from header or cookie
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('token')?.value;

  if (!token) {
    // not authenticated -> redirect or allow depending on your app
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

// Make sure to not run on static assets, etc.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

