import * as React from "react"
import { cn } from "@/lib/utils"

export interface FlagIconProps extends React.HTMLAttributes<HTMLDivElement> {
  countryCode: string
  size?: "xs" | "sm" | "md" | "lg"
}

const FlagIcon: React.FC<FlagIconProps> = ({
  countryCode,
  size = "md",
  className,
  ...props
}) => {
  const sizeClasses = {
    xs: "h-3.5 w-5 text-xs",
    sm: "h-4 w-6 text-sm",
    md: "h-5 w-7 text-base",
    lg: "h-6 w-8 text-lg",
  }

  // Convert country code to flag emoji
  const getFlagEmoji = (code: string) => {
    const codePoints = code
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }

  // Check if className includes 'rounded-full' to determine if it should be circular
  const isCircular = className?.includes('rounded-full') || props.style?.borderRadius === '50%'
  
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center overflow-hidden",
        isCircular ? "rounded-full" : "rounded-md pb-1",
        "bg-white/5 backdrop-blur-sm",
        "leading-0.5",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <span className="leading-0 vertical-align-middle">
        {getFlagEmoji(countryCode)}
      </span>
    </div>
  )
}

export { FlagIcon }

