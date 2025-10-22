"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/ui/icon-button"

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, value, onChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value || "")

    React.useEffect(() => {
      setInternalValue(value || "")
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value)
      onChange?.(e)
    }

    const handleClear = () => {
      setInternalValue("")
      onClear?.()
      const event = {
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>
      onChange?.(event)
    }

    return (
      <div className={cn("relative flex items-center", className)}>
        <Search className="absolute left-3 h-4 w-4 text-white/40 z-10 pointer-events-none" />
        <Input
          ref={ref}
          type="text"
          value={internalValue}
          onChange={handleChange}
          className="pl-9 pr-9 relative"
          {...props}
        />
        {internalValue && (
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="absolute right-1 h-7 w-7 z-10"
          >
            <X className="h-3 w-3" />
          </IconButton>
        )}
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"

export { SearchInput }

