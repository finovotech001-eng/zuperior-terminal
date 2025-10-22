"use client"

import * as React from "react"
import {
  Plus,
  Settings,
  Maximize,
  Undo,
  Redo,
  Save,
  Camera,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import { Divider } from "@/components/ui/divider"

export interface ChartToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  onAddIndicator?: () => void
  onSettings?: () => void
  onFullscreen?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onSave?: () => void
  onScreenshot?: () => void
  onMore?: () => void
}

const ChartToolbar: React.FC<ChartToolbarProps> = ({
  onAddIndicator,
  onSettings,
  onFullscreen,
  onUndo,
  onRedo,
  onSave,
  onScreenshot,
  onMore,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 bg-background border-b border-border",
        className
      )}
      {...props}
    >
      <IconButton size="sm" variant="ghost" onClick={onAddIndicator} title="Add Indicator">
        <Plus className="h-4 w-4" />
      </IconButton>

      <Divider orientation="vertical" className="h-5" />

      <IconButton size="sm" variant="ghost" onClick={onUndo} title="Undo">
        <Undo className="h-4 w-4" />
      </IconButton>

      <IconButton size="sm" variant="ghost" onClick={onRedo} title="Redo">
        <Redo className="h-4 w-4" />
      </IconButton>

      <Divider orientation="vertical" className="h-5" />

      <IconButton size="sm" variant="ghost" onClick={onSave} title="Save Layout">
        <Save className="h-4 w-4" />
      </IconButton>

      <IconButton size="sm" variant="ghost" onClick={onScreenshot} title="Screenshot">
        <Camera className="h-4 w-4" />
      </IconButton>

      <div className="flex-1" />

      <IconButton size="sm" variant="ghost" onClick={onSettings} title="Settings">
        <Settings className="h-4 w-4" />
      </IconButton>

      <IconButton size="sm" variant="ghost" onClick={onFullscreen} title="Fullscreen">
        <Maximize className="h-4 w-4" />
      </IconButton>

      <IconButton size="sm" variant="ghost" onClick={onMore} title="More">
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
    </div>
  )
}

export { ChartToolbar }

