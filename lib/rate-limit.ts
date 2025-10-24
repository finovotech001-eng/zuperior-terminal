interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// In-memory storage for rate limiting
const requestStore = new Map<string, number[]>()

/**
 * Simple sliding window rate limiter using in-memory storage
 */
class RateLimiter {
  constructor(
    private readonly requests: number,
    private readonly windowSeconds: number,
    private readonly prefix: string = 'ratelimit'
  ) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}:${identifier}`
    const now = Date.now()
    const windowStart = now - this.windowSeconds * 1000

    try {
      // Get or create the request timestamps array
      let timestamps = requestStore.get(key) || []
      
      // Remove old entries outside the window
      timestamps = timestamps.filter(ts => ts > windowStart)
      
      // Check if limit exceeded
      const count = timestamps.length
      const remaining = Math.max(0, this.requests - count - 1)
      const reset = now + this.windowSeconds * 1000

      if (count < this.requests) {
        // Add current request
        timestamps.push(now)
        requestStore.set(key, timestamps)

        return {
          success: true,
          limit: this.requests,
          remaining,
          reset: Math.floor(reset / 1000),
        }
      }

      return {
        success: false,
        limit: this.requests,
        remaining: 0,
        reset: Math.floor(reset / 1000),
      }
    } catch (error) {
      console.error('Rate limit error:', error)
      // Fail open - allow request if rate limiting fails
      return {
        success: true,
        limit: this.requests,
        remaining: this.requests - 1,
        reset: Math.floor((now + this.windowSeconds * 1000) / 1000),
      }
    }
  }
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of requestStore.entries()) {
    const filtered = timestamps.filter(ts => ts > now - 300000) // Keep last 5 minutes
    if (filtered.length === 0) {
      requestStore.delete(key)
    } else {
      requestStore.set(key, filtered)
    }
  }
}, 5 * 60 * 1000)

// Create different rate limiters for different endpoints
export const rateLimiters = {
  // Strict: 10 requests per 10 seconds (Auth endpoints)
  strict: new RateLimiter(10, 10, 'ratelimit:strict'),

  // Standard: 100 requests per minute (API endpoints)
  standard: new RateLimiter(100, 60, 'ratelimit:standard'),

  // Generous: 1000 requests per minute (Market data)
  generous: new RateLimiter(1000, 60, 'ratelimit:generous'),

  // WebSocket: 10000 messages per minute
  websocket: new RateLimiter(10000, 60, 'ratelimit:websocket'),
}

// Middleware helper for API routes
export async function checkRateLimit(
  identifier: string,
  limiter: RateLimiter = rateLimiters.standard
): Promise<RateLimitResult> {
  return await limiter.limit(identifier)
}

// Get identifier from request (IP or user ID)
export function getIdentifier(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`
  
  // Get IP from headers (consider proxies)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown'
  
  return `ip:${ip}`
}

export default RateLimiter
