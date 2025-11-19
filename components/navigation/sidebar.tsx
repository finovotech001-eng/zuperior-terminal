"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface SidebarItem {
  id: string
  icon: React.ReactNode
  label: string
  onClick?: () => void
  active?: boolean
}
// ✨ FIX 1: Add the missing props to the interface
export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  items: SidebarItem[]
  isCollapsed?: boolean // <-- Optional prop
  onCollapseToggle?: () => void // <-- Optional prop
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  className,
  ...props
}) => {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-full w-12 glass-card rounded-lg",
          className
        )}
        {...props}
      >
        <div className="flex-1 flex flex-col items-center py-2 gap-1">
          {items.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={item.onClick}
                  className={cn(
                    "relative flex items-center justify-center w-9 h-9 rounded-md",
                    item.active
                      ? "bg-primary/10 text-primary"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  {/* Active Indicator */}
                  {item.active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
                  )}
                  <div className="flex-shrink-0">{item.icon}</div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs px-2 py-1">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </aside>
    </TooltipProvider>
  )
}

export { Sidebar }

