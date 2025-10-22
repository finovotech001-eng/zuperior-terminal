"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, onCheckedChange, checked, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(checked || false)

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked)
      }
    }, [checked])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked
      setIsChecked(newChecked)
      onCheckedChange?.(newChecked)
      props.onChange?.(e)
    }

    return (
      <label className={cn("relative inline-flex cursor-pointer items-center", className)}>
        <input
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          checked={isChecked}
          onChange={handleChange}
          {...props}
        />
        <div className="h-6 w-11 rounded-full bg-white/5 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 transition-colors" />
        <motion.div
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white"
          animate={{
            x: isChecked ? 20 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
          }}
        />
      </label>
    )
  }
)
Toggle.displayName = "Toggle"

export { Toggle }

