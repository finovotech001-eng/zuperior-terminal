// /components/trading/balance-display.tsx

"use client"

import * as React from "react"
// Note: Eye/EyeOff are not needed here if parent controls the visibility toggle
import { cn, formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export interface BalanceInfo {
  balance: number
  equity: number
  margin: number
  freeMargin: number
  marginLevel: number
  leverage: string
  credit: number
}

export interface BalanceDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  balanceInfo: BalanceInfo
  // ⚠️ Ensure this is defined
  hideBalance: boolean;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balanceInfo,
  // 🚀 FIX: Destructure `hideBalance` to prevent it from leaking to the DOM via `...props`
  hideBalance,
  className,
  ...props // This now contains only valid HTML attributes (like 'id', 'aria-*', or 'data-*') and 'className'
}) => {
  // Local state [isHidden, setIsHidden] is removed, using the prop `hideBalance` instead.

  const { balance, equity, margin, freeMargin, marginLevel, leverage, credit } = balanceInfo
  const newLeverage = `1:${leverage}`;

  const formatValue = (value: number) => {
    // 🚀 Use the parent-controlled `hideBalance` prop
    return hideBalance ? "••••••" : formatCurrency(value, 2)
  }

  const safeMarginLevel = typeof marginLevel === 'number' ? marginLevel : 0;
  const marginLevelDisplay = safeMarginLevel.toFixed(2);


  return (
    // 🌟 This is where the fix takes effect: `hideBalance` is no longer in `...props`
    <Card className={cn("p-4", className)} {...props}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Account Balance</h3>
        {/* The local toggle button is intentionally removed */}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            Balance
          </div>
          <div className="text-lg font-bold price-font">{formatValue(balance)} USD</div>
        </div>
        {/* ... remaining display elements using formatValue(value) ... */}
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            Equity
          </div>
          <div className="text-lg font-bold price-font">{formatValue(equity)} USD</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Margin</div>
          <div className="text-sm font-medium price-font">{formatValue(margin)} USD</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Free Margin</div>
          <div className="text-sm font-medium price-font">{formatValue(freeMargin)} USD</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Credit</div>
          <div className="text-sm font-medium price-font">{formatValue(credit)} USD</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Margin Level</span>
          <span className="font-medium price-font">{marginLevelDisplay}%</span>
        </div>
        <Progress value={Math.min(safeMarginLevel, 100)} className="h-2" />
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Account Leverage</span>
          <span className="font-bold">{newLeverage}</span>
        </div>
      </div>
    </Card>
  )
}

export { BalanceDisplay }