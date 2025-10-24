import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface HealthCheck {
  timestamp: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  checks: {
    database: 'healthy' | 'unhealthy' | 'unknown'
    api: 'healthy'
  }
  version?: string
}

export async function GET() {
  const startTime = Date.now()

  const checks: HealthCheck = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      api: 'healthy',
    },
    version: process.env.npm_package_version || '1.0.0',
  }

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.checks.database = 'healthy'
  } catch (error) {
    console.error('Database health check failed:', error)
    checks.checks.database = 'unhealthy'
    checks.status = 'unhealthy'
  }

  const responseTime = Date.now() - startTime

  return NextResponse.json(
    {
      ...checks,
      responseTime: `${responseTime}ms`,
    },
    {
      status: checks.status === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}

