import { z } from 'zod'

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis (optional for development)
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  NEXT_PUBLIC_JWT_SECRET: z.string().optional(),

  // MT5 API
  NEXT_PUBLIC_API_BASE_URL: z.string().url('Invalid API_BASE_URL'),
  LIVE_API_URL: z.string().url('Invalid LIVE_API_URL').default('http://18.130.5.209:5003/api'),
  MANAGER_USERNAME: z.string().min(1, 'MANAGER_USERNAME is required'),
  MANAGER_PASSWORD: z.string().min(1, 'MANAGER_PASSWORD is required'),
  MANAGER_SERVER_IP: z.string().min(1, 'MANAGER_SERVER_IP is required'),
  MANAGER_PORT: z.string().min(1, 'MANAGER_PORT is required'),
  MANAGER_LOGIN_PATH: z.string().min(1, 'MANAGER_LOGIN_PATH is required'),
  MARKET_DATA_SYMBOLS_PATH: z.string().min(1, 'MARKET_DATA_SYMBOLS_PATH is required'),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

// Type for validated environment
export type Env = z.infer<typeof envSchema>

// Validate environment variables
export function validateEnv(): Env {
  try {
    const validated = envSchema.parse(process.env)
    console.log('✅ Environment variables validated successfully')
    return validated
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      
      // In production, fail hard. In development, warn but continue
      if (process.env.NODE_ENV === 'production') {
        process.exit(1)
      } else {
        console.warn('⚠️  Running with invalid environment variables (development only)')
      }
    }
    throw error
  }
}

// Safe environment accessor with fallbacks
export const env = new Proxy(process.env as Env, {
  get(target, prop: string) {
    const value = target[prop as keyof Env]
    
    if (value === undefined && process.env.NODE_ENV === 'production') {
      console.error(`❌ Missing required environment variable: ${prop}`)
    }
    
    return value
  },
})

// Validate on module load in production
if (process.env.NODE_ENV === 'production') {
  validateEnv()
}

export default env

