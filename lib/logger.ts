/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Simple logger utility with different log levels
 * Can be extended with Winston/Pino for production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private logLevel: LogLevel

  constructor() {
    const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
    this.logLevel = level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(this.logLevel)
    const messageIndex = levels.indexOf(level)
    return messageIndex >= currentIndex
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const levelStr = level.toUpperCase().padEnd(5)
    
    let formatted = `[${timestamp}] ${levelStr} ${message}`
    
    if (context) {
      formatted += ` ${JSON.stringify(context)}`
    }
    
    return formatted
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        ...(error instanceof Error && {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        }),
      }
      console.error(this.formatMessage('error', message, errorContext))
    }
  }

  // API request logger
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API ${method} ${path}`, context)
  }

  // API response logger
  apiResponse(method: string, path: string, status: number, duration: number): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    this[level](`API ${method} ${path} - ${status}`, { duration: `${duration}ms` })
  }

  // Database query logger
  dbQuery(query: string, duration: number, context?: LogContext): void {
    this.debug(`DB Query`, {
      query: query.substring(0, 100),
      duration: `${duration}ms`,
      ...context,
    })
  }

  // Cache operation logger
  cache(operation: string, key: string, hit: boolean): void {
    this.debug(`Cache ${operation}`, { key, hit })
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for custom instances
export default Logger

