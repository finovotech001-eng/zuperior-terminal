/**
 * WebSocket Connection Status Indicator
 */

import React from 'react'
import { useWebSocketStatus } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

interface WebSocketStatusProps {
  className?: string
  showDetails?: boolean
  positionsConnected?: boolean // SignalR positions connection status
}

export function WebSocketStatus({ className, showDetails = false, positionsConnected }: WebSocketStatusProps) {
  const status = useWebSocketStatus()

  // Consider user "Live" if positions are connected (SignalR) OR if WebSocket connections are working
  // This fixes the "Offline" issue when user is online but WebSockets might not all be connected
  const isAllWebSocketConnected = 
    status.liveData === 'Connected' &&
    status.chart === 'Connected' &&
    status.trading === 'Connected'

  const isAnyWebSocketConnected = 
    status.liveData === 'Connected' ||
    status.chart === 'Connected' ||
    status.trading === 'Connected'

  // User is considered "Live" if positions are connected OR if WebSockets are connected
  const isUserOnline = positionsConnected === true || isAnyWebSocketConnected
  const isAllConnected = positionsConnected === true && isAllWebSocketConnected

  const getStatusColor = (state: string) => {
    if (state === 'Connected') return 'text-green-500'
    if (state === 'Connecting' || state === 'Reconnecting') return 'text-yellow-500'
    return 'text-red-500'
  }

  const getStatusIcon = (state: string) => {
    if (state === 'Connected') return '●'
    if (state === 'Connecting' || state === 'Reconnecting') return '◐'
    return '○'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Simple indicator */}
      {!showDetails && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-medium',
              isUserOnline
                ? 'text-green-500'
                : isAnyWebSocketConnected
                ? 'text-yellow-500'
                : 'text-red-500'
            )}
          >
            {getStatusIcon(isUserOnline ? 'Connected' : isAnyWebSocketConnected ? 'Connecting' : 'Disconnected')}
          </span>
          <span className="text-xs text-white/60">
            {isUserOnline ? 'Live' : isAnyWebSocketConnected ? 'Connecting...' : 'Offline'}
          </span>
        </div>
      )}

      {/* Detailed status */}
      {showDetails && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs', getStatusColor(status.liveData))}>
              {getStatusIcon(status.liveData)}
            </span>
            <span className="text-xs text-white/60">Prices</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs', getStatusColor(status.chart))}>
              {getStatusIcon(status.chart)}
            </span>
            <span className="text-xs text-white/60">Charts</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs', getStatusColor(status.trading))}>
              {getStatusIcon(status.trading)}
            </span>
            <span className="text-xs text-white/60">Trading</span>
          </div>
        </div>
      )}
    </div>
  )
}

