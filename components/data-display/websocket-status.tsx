/**
 * WebSocket Connection Status Indicator
 */

import React from 'react'
import { useWebSocketStatus } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

interface WebSocketStatusProps {
  className?: string
  showDetails?: boolean
}

export function WebSocketStatus({ className, showDetails = false }: WebSocketStatusProps) {
  const status = useWebSocketStatus()

  const isAllConnected = 
    status.liveData === 'Connected' &&
    status.chart === 'Connected' &&
    status.trading === 'Connected'

  const isAnyConnected = 
    status.liveData === 'Connected' ||
    status.chart === 'Connected' ||
    status.trading === 'Connected'

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
              isAllConnected
                ? 'text-green-500'
                : isAnyConnected
                ? 'text-yellow-500'
                : 'text-red-500'
            )}
          >
            {getStatusIcon(isAllConnected ? 'Connected' : isAnyConnected ? 'Connecting' : 'Disconnected')}
          </span>
          <span className="text-xs text-white/60">
            {isAllConnected ? 'Live' : isAnyConnected ? 'Connecting...' : 'Offline'}
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





