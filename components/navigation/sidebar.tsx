"use client"

import * as React from "react"
import { motion } from "framer-motion"
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
  isCollapsed: boolean // <-- Prop that was causing the warning
  onCollapseToggle: () => void // <-- Prop that was also passed from parent
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  className,
  isCollapsed, // ✨ FIX 2: Destructure 'isCollapsed'
  onCollapseToggle, // ✨ FIX 3: Destructure 'onCollapseToggle'
  ...props
}) => {
  return (
    <TooltipProvider delayDuration={300}>
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
                <motion.button
                  onClick={item.onClick}
                  className={cn(
                    "relative flex items-center justify-center w-9 h-9 rounded-md",
                    "transition-all duration-200",
                    item.active
                      ? "bg-primary/10 text-primary"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Active Indicator */}
                  {item.active && (
                    <motion.div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full"
                      layoutId="activeIndicator"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                  <div className="flex-shrink-0">{item.icon}</div>
                </motion.button>
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

