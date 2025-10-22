"use client"

import * as React from "react"
import {
  Crosshair,
  TrendingUp,
  Minus,
  Type,
  Circle,
  Lock,
  BarChart3,
  Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import { Divider } from "@/components/ui/divider"

export interface DrawingTool {
  id: string
  icon: React.ReactNode
  label: string
  active?: boolean
}

export interface DrawingToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  onToolSelect?: (toolId: string) => void
  activeTool?: string
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  onToolSelect,
  activeTool = "crosshair",
  className,
  ...props
}) => {
  const tools: DrawingTool[] = [
    { id: "crosshair", icon: <Crosshair className="h-4 w-4" />, label: "Crosshair" },
    { id: "trendline", icon: <TrendingUp className="h-4 w-4" />, label: "Trend Line" },
    { id: "horizontal", icon: <Minus className="h-4 w-4" />, label: "Horizontal Line" },
    { id: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
    { id: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
    { id: "pencil", icon: <Pencil className="h-4 w-4" />, label: "Draw" },
    { id: "chart-type", icon: <BarChart3 className="h-4 w-4" />, label: "Chart Type" },
    { id: "lock", icon: <Lock className="h-4 w-4" />, label: "Lock" },
  ]

  return (
    <div
      className={cn(
        "flex flex-col gap-1 bg-background border-r border-border p-2",
        className
      )}
      {...props}
    >
      {tools.map((tool, index) => (
        <React.Fragment key={tool.id}>
          <IconButton
            size="md"
            variant={activeTool === tool.id ? "primary" : "ghost"}
            onClick={() => onToolSelect?.(tool.id)}
            title={tool.label}
          >
            {tool.icon}
          </IconButton>
          {(index === 2 || index === 5) && <Divider className="my-1" />}
        </React.Fragment>
      ))}
    </div>
  )
}

export { DrawingToolbar }

