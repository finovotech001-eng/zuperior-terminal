"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { dropdownVariants } from "@/lib/animations"

export interface FilterOption {
  label: string
  value: string
}

export interface FilterDropdownProps {
  options: FilterOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select option",
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedValue, setSelectedValue] = React.useState(value || options[0]?.value)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (value) setSelectedValue(value)
  }, [value])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (optionValue: string) => {
    setSelectedValue(optionValue)
    onChange?.(optionValue)
    setIsOpen(false)
  }

  const selectedOption = options.find(opt => opt.value === selectedValue)

  return (
    <div ref={dropdownRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-white/10",
          "bg-white/5 px-3 py-2 text-sm text-white backdrop-blur-sm",
          "hover:bg-white/8 hover:border-white/15",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors"
        )}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden",
              "rounded-md border border-white/10 bg-popover backdrop-blur-md"
            )}
          >
            <div className="p-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center",
                    "rounded px-2 py-1.5 text-sm text-white outline-none",
                    "hover:bg-white/10",
                    "transition-colors",
                    selectedValue === option.value && "bg-white/10"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValue === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { FilterDropdown }

