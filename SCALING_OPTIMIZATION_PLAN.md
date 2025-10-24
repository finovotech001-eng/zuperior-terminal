# Zuperior Trading Terminal - Scaling Optimization Plan

## Overview

This document outlines the step-by-step implementation plan to scale the Zuperior Trading Terminal from handling ~50 concurrent users to 10,000+ users with production-grade performance, security, and reliability.

---

## Phase 1: Critical Foundation (Week 1-2)

### Priority: CRITICAL - Must be done first

### 1.1 Database Optimization

#### **A. Add Connection Pooling**

**File:** `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool configuration
  relationMode = "prisma"
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "fullTextIndex"]
}
```

**File:** `lib/prisma.ts` (NEW)

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Connection pool settings in DATABASE_URL
// postgresql://user:password@host:port/database?connection_limit=20&pool_timeout=60
```

**Environment Variables:**

```env
# Update DATABASE_URL with connection pool settings
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=60&connect_timeout=10"
```

#### **B. Add Database Indexes**

**File:** `prisma/schema.prisma`

```prisma
model User {
  id               String      @id @default(uuid())
  clientId         String      @unique @default(cuid())
  email            String      @unique
  password         String
  name             String?
  phone            String?
  country          String?
  role             String      @default("user")
  status           String      @default("active")
  emailVerified    Boolean     @default(false)
  lastLoginAt      DateTime?
  createdAt        DateTime    @default(now())
  
  accounts         Account[]
  transactions     Transaction[]
  kyc              KYC?
  mt5Accounts      MT5Account[]
  manualDeposits   ManualDeposit[]
  withdrawals      Withdrawal[]
  activityLogs     ActivityLog[]

  // Add indexes for performance
  @@index([email])
  @@index([clientId])
  @@index([status])
  @@index([createdAt])
  @@index([lastLoginAt])
}

model MT5Account {
  id               String           @id @default(uuid())
  accountId        String           @unique
  userId           String
  user             User             @relation(fields: [userId], references: [id])
  createdAt        DateTime         @default(now())
  
  mt5Transactions  MT5Transaction[]
  manualDeposits   ManualDeposit[]
  
  @@index([userId])
  @@index([accountId])
}

model ManualDeposit {
  id                String      @id @default(uuid())
  userId            String
  user              User        @relation(fields: [userId], references: [id])
  mt5AccountId      String
  mt5Account        MT5Account  @relation(fields: [mt5AccountId], references: [accountId])
  amount            Float
  depositAddress    String
  transactionHash   String?
  proofFileUrl      String?
  status            String      @default("pending")
  rejectionReason   String?
  approvedAt        DateTime?
  rejectedAt        DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@index([userId])
  @@index([mt5AccountId])
  @@index([status])
  @@index([createdAt])
}

model Withdrawal {
  id                String      @id @default(uuid())
  userId            String
  user              User        @relation(fields: [userId], references: [id])
  mt5AccountId      String
  amount            Float
  method            String
  bankDetails       String?
  cryptoAddress     String?
  status            String      @default("pending")
  rejectionReason   String?
  approvedBy        String?
  approvedAt        DateTime?
  rejectedAt        DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model ActivityLog {
  id                String      @id @default(uuid())
  userId            String?
  adminId           String
  admin             User        @relation(fields: [adminId], references: [id])
  action            String
  entity            String
  entityId          String?
  ipAddress         String?
  userAgent         String?
  oldValues         String?
  newValues         String?
  createdAt         DateTime    @default(now())
  
  @@index([adminId])
  @@index([userId])
  @@index([action])
  @@index([entity])
  @@index([createdAt])
}
```

**Migration Command:**

```bash
npx prisma migrate dev --name add_performance_indexes
npx prisma generate
```

---

### 1.2 Redis Caching Layer

#### **A. Install Redis Dependencies**

```bash
npm install ioredis
npm install -D @types/ioredis
```

#### **B. Create Redis Client**

**File:** `lib/redis.ts` (NEW)

```typescript
import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  
  // Fallback to individual parts
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;
  
  if (password) {
    return `redis://:${password}@${host}:${port}`;
  }
  
  return `redis://${host}:${port}`;
};

// Create Redis client with retry strategy
export const redis = new Redis(getRedisUrl(), {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect when encountering READONLY error
      return true;
    }
    return false;
  },
});

// Handle Redis connection events
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

// Cache utility functions
export const cacheUtils = {
  // Get cached value
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  // Set cache with TTL (in seconds)
  async set(key: string, value: unknown, ttl: number = 3600): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  },

  // Delete cache key
  async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  },

  // Delete multiple keys by pattern
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;
      const result = await redis.del(...keys);
      return result;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  },

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  // Get remaining TTL
  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  },
};

export default redis;
```

**Environment Variables:**

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password_here
```

---

### 1.3 Rate Limiting

#### **A. Install Dependencies**

```bash
npm install @upstash/ratelimit
```

#### **B. Create Rate Limiter**

**File:** `lib/rate-limit.ts` (NEW)

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import redis from './redis';

// Create different rate limiters for different endpoints
export const rateLimiters = {
  // Strict: 10 requests per 10 seconds (Auth endpoints)
  strict: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
    prefix: 'ratelimit:strict',
  }),

  // Standard: 100 requests per minute (API endpoints)
  standard: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:standard',
  }),

  // Generous: 1000 requests per minute (Market data)
  generous: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 m'),
    analytics: true,
    prefix: 'ratelimit:generous',
  }),

  // WebSocket: 10000 messages per minute
  websocket: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10000, '1 m'),
    analytics: true,
    prefix: 'ratelimit:websocket',
  }),
};

// Middleware helper for API routes
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit = rateLimiters.standard
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    reset,
  };
}

// Get identifier from request (IP or user ID)
export function getIdentifier(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  
  // Get IP from headers (consider proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  
  return `ip:${ip}`;
}
```

#### **C. Apply Rate Limiting to API Routes**

**File:** `app/apis/auth/login/route.ts` (UPDATE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getIdentifier, rateLimiters } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Apply strict rate limiting for auth
    const identifier = getIdentifier(request);
    const rateLimit = await checkRateLimit(identifier, rateLimiters.strict);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          },
        }
      );
    }

    // Continue with existing login logic...
    const body = await request.json();
    // ... rest of login logic
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 1.4 Input Validation

#### **A. Install Zod**

```bash
npm install zod
```

#### **B. Create Validation Schemas**

**File:** `lib/validations.ts` (NEW)

```typescript
import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(15, 'Password must be at most 15 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
});

// Trading schemas
export const orderSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  side: z.enum(['buy', 'sell']),
  volume: z.number().positive('Volume must be positive'),
  orderType: z.enum(['market', 'limit', 'stop']),
  price: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  accountId: z.string().min(1, 'Account ID is required'),
});

// Validation helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}
```

#### **C. Apply Validation to Routes**

**File:** `app/apis/trading/route.ts` (UPDATE)

```typescript
import { validateRequest, orderSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateRequest(orderSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation error',
          errors: validation.errors.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Use validated data
    const validatedData = validation.data;
    
    // Continue with trade logic...
  } catch (error) {
    console.error('Trade error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 1.5 Environment Variable Validation

**File:** `lib/env.ts` (NEW)

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  
  // MT5 API
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  MANAGER_USERNAME: z.string().min(1),
  MANAGER_PASSWORD: z.string().min(1),
  MANAGER_SERVER_IP: z.string().ip(),
  MANAGER_PORT: z.string(),
  MANAGER_LOGIN_PATH: z.string(),
  MARKET_DATA_SYMBOLS_PATH: z.string(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

// Validate environment variables on startup
export function validateEnv() {
  try {
    envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Call validation on import in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}

export const env = process.env as z.infer<typeof envSchema>;
```

**File:** `app/layout.tsx` (UPDATE)

```typescript
import { validateEnv } from '@/lib/env';

// Validate environment variables on startup
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}

// ... rest of layout
```

---

## Phase 2: WebSocket & Real-time Updates (Week 3-4)

### 2.1 WebSocket Implementation

#### **A. Install Socket.io**

```bash
npm install socket.io socket.io-client
npm install -D @types/socket.io @types/socket.io-client
```

#### **B. Create WebSocket Server**

**File:** `lib/socket-server.ts` (NEW)

```typescript
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { redis } from './redis';
import { checkRateLimit, rateLimiters } from './rate-limit';

export class WebSocketServer {
  private io: SocketIOServer;
  private accountSubscriptions: Map<string, Set<string>> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify JWT token
      try {
        // Add your JWT verification logic here
        socket.data.userId = 'verified_user_id';
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    // Rate limiting middleware
    this.io.use(async (socket, next) => {
      const userId = socket.data.userId;
      const rateLimit = await checkRateLimit(
        `ws:${userId}`,
        rateLimiters.websocket
      );

      if (!rateLimit.success) {
        return next(new Error('Rate limit exceeded'));
      }

      next();
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      // Subscribe to account updates
      socket.on('subscribe:account', async (accountId: string) => {
        socket.join(`account:${accountId}`);
        
        // Track subscriptions
        if (!this.accountSubscriptions.has(accountId)) {
          this.accountSubscriptions.set(accountId, new Set());
        }
        this.accountSubscriptions.get(accountId)?.add(socket.id);

        console.log(`📊 Client ${socket.id} subscribed to account ${accountId}`);

        // Send initial data
        const cachedData = await redis.get(`balance:${accountId}`);
        if (cachedData) {
          socket.emit('account:update', JSON.parse(cachedData as string));
        }
      });

      // Unsubscribe from account updates
      socket.on('unsubscribe:account', (accountId: string) => {
        socket.leave(`account:${accountId}`);
        this.accountSubscriptions.get(accountId)?.delete(socket.id);
        console.log(`📊 Client ${socket.id} unsubscribed from account ${accountId}`);
      });

      // Subscribe to market data
      socket.on('subscribe:market', (symbols: string[]) => {
        symbols.forEach((symbol) => {
          socket.join(`market:${symbol}`);
        });
        console.log(`📈 Client ${socket.id} subscribed to ${symbols.length} symbols`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        
        // Clean up subscriptions
        this.accountSubscriptions.forEach((sockets) => {
          sockets.delete(socket.id);
        });
      });
    });
  }

  // Broadcast account balance update
  public broadcastAccountUpdate(accountId: string, data: unknown) {
    this.io.to(`account:${accountId}`).emit('account:update', data);
  }

  // Broadcast market data update
  public broadcastMarketUpdate(symbol: string, data: unknown) {
    this.io.to(`market:${symbol}`).emit('market:update', data);
  }

  // Get connected clients count
  public getConnectionsCount(): number {
    return this.io.sockets.sockets.size;
  }
}
```

---

## Phase 3: Frontend Optimization (Week 3-4)

### 3.1 Code Splitting & Lazy Loading

**File:** `app/terminal/page.tsx` (UPDATE)

```typescript
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load heavy components
const ChartContainer = dynamic(() => import('@/components/chart/chart-container'), {
  loading: () => <div className="h-full flex items-center justify-center">Loading chart...</div>,
  ssr: false,
});

const PositionsTable = dynamic(() => import('@/components/trading/positions-table'), {
  loading: () => <div className="h-[56px] glass-card rounded-lg" />,
});

const InstrumentList = dynamic(() => import('@/components/trading/instrument-list'), {
  loading: () => <div className="h-full flex items-center justify-center">Loading instruments...</div>,
});

const EconomicCalendar = dynamic(() => import('@/components/trading/economic-calendar'), {
  loading: () => <div className="h-full flex items-center justify-center">Loading calendar...</div>,
});

const OrderPanel = dynamic(() => import('@/components/trading/order-panel'), {
  loading: () => <div className="w-full h-full glass-card rounded-lg" />,
});

export default function TerminalPage() {
  return (
    <Suspense fallback={<div>Loading terminal...</div>}>
      <TerminalContent />
    </Suspense>
  );
}
```

### 3.2 React Memoization

**File:** `components/trading/order-panel.tsx` (UPDATE)

```typescript
import { memo, useCallback, useMemo } from 'react';

export const OrderPanel = memo(function OrderPanel({
  symbol,
  countryCode,
  sellPrice,
  buyPrice,
  spread,
  onBuy,
  onSell,
  className,
}: OrderPanelProps) {
  // Memoize callbacks
  const handleBuy = useCallback((data: OrderData) => {
    onBuy(data);
  }, [onBuy]);

  const handleSell = useCallback((data: OrderData) => {
    onSell(data);
  }, [onSell]);

  // Memoize computed values
  const spreadValue = useMemo(() => {
    return parseFloat(spread.replace(' USD', ''));
  }, [spread]);

  // ... rest of component
});
```

---

## Phase 4: Monitoring & Observability (Month 2)

### 4.1 Health Checks

**File:** `app/apis/health/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import redis from '@/lib/redis';

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      database: 'unknown',
      redis: 'unknown',
      api: 'healthy',
    },
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    checks.checks.redis = 'healthy';
  } catch (error) {
    checks.checks.redis = 'unhealthy';
    checks.status = 'degraded';
  }

  return NextResponse.json(checks, {
    status: checks.status === 'healthy' ? 200 : 503,
  });
}
```

---

## Deployment Checklist

### Pre-deployment

- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] Redis cluster provisioned
- [ ] SSL certificates configured
- [ ] CORS policies set
- [ ] Rate limiting tested
- [ ] Load testing completed
- [ ] Monitoring dashboards created

### Production

- [ ] Multi-instance deployment (min 2)
- [ ] Load balancer configured
- [ ] Auto-scaling rules set
- [ ] Database backups automated
- [ ] Redis persistence enabled
- [ ] Log aggregation active
- [ ] Error tracking enabled
- [ ] Performance monitoring active

---

## Success Metrics Tracking

Monitor these metrics after each optimization:

1. **Response Time:** P50, P95, P99
2. **Error Rate:** 4xx and 5xx errors
3. **Throughput:** Requests per second
4. **Database:** Query time, connection pool usage
5. **Cache:** Hit rate, memory usage
6. **WebSocket:** Active connections, message rate
7. **Server:** CPU, memory, disk usage

---

**Next Document:** See `DOCKER_DEPLOYMENT.md` for containerization guide.

