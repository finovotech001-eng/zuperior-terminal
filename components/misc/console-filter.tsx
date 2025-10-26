"use client"

import * as React from 'react'

// Suppress all console output in the browser except explicit trade logs
// Keep only messages that include the token "[Trade]" (e.g. [Trade][BUY]/[Trade][SELL])
export default function ConsoleFilter() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const methods: (keyof Console)[] = ['log', 'info', 'warn', 'error', 'debug']
    const original: Partial<Record<string, any>> = {}

    const shouldKeep = (args: any[]): boolean => {
      try {
        const first = args?.[0]
        const msg = typeof first === 'string' ? first : ''
        return msg.includes('[Trade]')
      } catch {
        return false
      }
    }

    methods.forEach((m) => {
      original[m] = console[m].bind(console)
      console[m] = (...args: any[]) => {
        if (shouldKeep(args)) {
          ;(original[m] as any)(...args)
        }
      }
    })

    return () => {
      methods.forEach((m) => {
        if (original[m]) {
          // @ts-ignore
          console[m] = original[m]
        }
      })
    }
  }, [])

  return null
}

