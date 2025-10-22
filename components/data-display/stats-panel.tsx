import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface StatItem {
  label: string
  value: string | number
  change?: number
  trend?: "up" | "down" | "neutral"
}

export interface StatsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  stats: StatItem[]
  columns?: number
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  columns = 4,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 md:grid-cols-2",
        columns === 3 && "grid-cols-1 md:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
      {...props}
    >
      {stats.map((stat, index) => (
        <Card key={index} className="px-6">
          <CardHeader className="pb-2 px-0">
            <CardTitle className="text-sm font-medium text-white/60">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-white price-font">{stat.value}</div>
              {stat.change !== undefined && (
                <div
                  className={cn(
                    "text-xs font-medium",
                    stat.trend === "up" && "text-success",
                    stat.trend === "down" && "text-danger",
                    stat.trend === "neutral" && "text-white/60"
                  )}
                >
                  {stat.change > 0 && "+"}
                  {stat.change}%
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export { StatsPanel }

