"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"

export interface NumberStepperProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  precision?: number
}

const NumberStepper = React.forwardRef<HTMLInputElement, NumberStepperProps>(
  ({ className, value = 0, onChange, min, max, step = 1, precision = 2, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value)

    React.useEffect(() => {
      setInternalValue(value)
    }, [value])

    const handleIncrement = () => {
      const newValue = Math.min(internalValue + step, max ?? Infinity)
      const rounded = Number(newValue.toFixed(precision))
      setInternalValue(rounded)
      onChange?.(rounded)
    }

    const handleDecrement = () => {
      const newValue = Math.max(internalValue - step, min ?? -Infinity)
      const rounded = Number(newValue.toFixed(precision))
      setInternalValue(rounded)
      onChange?.(rounded)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value) || 0
      setInternalValue(newValue)
      onChange?.(newValue)
    }

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <IconButton
          type="button"
          size="sm"
          variant="default"
          onClick={handleDecrement}
          disabled={min !== undefined && internalValue <= min}
        >
          <Minus className="h-3 w-3" />
        </IconButton>
        
        <input
          ref={ref}
          type="number"
          value={internalValue}
          onChange={handleInputChange}
          className={cn(
            "h-9 w-20 rounded-md border border-white/10 bg-white/5 px-3 py-1",
            "text-center text-sm text-white price-font backdrop-blur-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            "focus-visible:border-white/15 focus-visible:bg-white/8",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          )}
          {...props}
        />
        
        <IconButton
          type="button"
          size="sm"
          variant="default"
          onClick={handleIncrement}
          disabled={max !== undefined && internalValue >= max}
        >
          <Plus className="h-3 w-3" />
        </IconButton>
      </div>
    )
  }
)
NumberStepper.displayName = "NumberStepper"

export { NumberStepper }

