"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface WeekendToastProps {
  message: string
  onDismiss: () => void
  className?: string
}

export function WeekendToast({ message, onDismiss, className }: WeekendToastProps) {
  React.useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      onDismiss()
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className={cn("fixed top-4 right-4 z-50 animate-in slide-in-from-top-5", className)}>
      <div className="glass-card border border-orange-500/30 rounded-md shadow-xl px-4 py-3 min-w-[320px] max-w-sm text-sm bg-orange-500/10 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30 flex-shrink-0">
            ⚠
          </div>
          <div className="flex-1">
            <div className="font-semibold text-orange-300">Trading Restricted</div>
            <div className="text-white/80 mt-0.5 leading-snug">{message}</div>
          </div>
          <button
            className="text-white/50 hover:text-white/80 text-xs flex-shrink-0"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

