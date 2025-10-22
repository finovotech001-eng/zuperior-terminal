import * as React from "react"
import { cn } from "@/lib/utils"

export interface VariantGridProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  cols?: number
}

const VariantGrid: React.FC<VariantGridProps> = ({
  title,
  cols = 4,
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {title && <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>}
      <div
        className={cn(
          "grid gap-4",
          cols === 2 && "grid-cols-1 md:grid-cols-2",
          cols === 3 && "grid-cols-1 md:grid-cols-3",
          cols === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          cols === 5 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
          cols === 6 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-6"
        )}
      >
        {children}
      </div>
    </div>
  )
}

export { VariantGrid }

