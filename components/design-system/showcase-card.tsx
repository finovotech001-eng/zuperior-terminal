import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface ShowcaseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
}

const ShowcaseCard: React.FC<ShowcaseCardProps> = ({
  title,
  description,
  children,
  className,
  ...props
}) => {
  return (
    <Card className={cn("", className)} {...props}>
      <CardHeader>
        <CardTitle className="text-base text-white">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs text-white/60">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        {children}
      </CardContent>
    </Card>
  )
}

export { ShowcaseCard }

