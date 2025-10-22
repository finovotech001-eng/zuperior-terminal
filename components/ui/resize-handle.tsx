"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ResizeHandleProps {
  direction: "horizontal" | "vertical"
  onResize: (delta: number) => void
  className?: string
}

export function ResizeHandle({ direction, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const startPosRef = React.useRef<number>(0)

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY
  }, [direction])

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY
      const delta = currentPos - startPosRef.current
      startPosRef.current = currentPos
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize"
    document.body.style.userSelect = "none"

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isDragging, direction, onResize])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "group absolute z-10 transition-colors",
        direction === "horizontal" 
          ? "top-0 bottom-0 w-0 cursor-col-resize" 
          : "left-0 right-0 h-4 cursor-row-resize",
        className
      )}
      style={
        direction === "horizontal"
          ? { transform: "translateX(-50%)" }
          : { transform: "translateY(-50%)" }
      }
    >
      {/* Visual indicator - shows on hover */}
      <div 
        className={cn(
          "absolute transition-all",
          "bg-primary/40 opacity-0 group-hover:opacity-100",
          isDragging && "opacity-100 bg-primary/60",
          direction === "horizontal" 
            ? "left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2" 
            : "top-1/2 left-0 right-0 h-0.5 -translate-y-1/2"
        )}
      />
    </div>
  )
}

