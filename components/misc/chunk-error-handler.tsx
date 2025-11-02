"use client"

import { useEffect } from 'react'

/**
 * Client component to handle ChunkLoadError and automatically retry/reload
 */
export default function ChunkErrorHandler() {
  useEffect(() => {
    // Handle chunk load errors globally
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error
      
      // Check if it's a ChunkLoadError
      if (
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('chunk') ||
        error?.message?.includes('timeout')
      ) {
        console.warn('ChunkLoadError detected, attempting to reload page...')
        
        // Wait a bit before reloading to avoid rapid reload loops
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        }, 1000)
      }
    }

    // Listen for unhandled errors
    window.addEventListener('error', handleChunkError)
    
    // Also listen for unhandled promise rejections (chunk errors often come as promises)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      
      if (
        reason?.name === 'ChunkLoadError' ||
        reason?.message?.includes('Loading chunk') ||
        reason?.message?.includes('chunk') ||
        reason?.message?.includes('timeout')
      ) {
        console.warn('ChunkLoadError in promise rejection, attempting to reload page...')
        
        event.preventDefault() // Prevent default error logging
        
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        }, 1000)
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleChunkError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null // This component doesn't render anything
}

