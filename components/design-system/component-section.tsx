import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface ComponentSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
}

const ComponentSection: React.FC<ComponentSectionProps> = ({
  title,
  description,
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
        {description && (
          <p className="text-white/60 mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}

export { ComponentSection }

