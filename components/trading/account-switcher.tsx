"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface MT5Account {
  id: string
  accountId: string
  displayAccountId: string
  linkedAt: string
}

interface AccountSwitcherProps {
  accounts: MT5Account[]
  selectedAccountId: string | null
  onAccountChange: (accountId: string) => void
  isLoading?: boolean
  className?: string
}

export function AccountSwitcher({
  accounts,
  selectedAccountId,
  onAccountChange,
  isLoading = false,
  className
}: AccountSwitcherProps) {
  const handleAccountSelect = (accountId: string) => {
    onAccountChange(accountId)
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-md bg-white/5", className)}>
        <div className="w-4 h-4 bg-white/20 rounded animate-pulse" />
        <span className="text-sm text-white/60">Loading accounts...</span>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-md bg-white/5", className)}>
        <span className="text-sm text-white/60">No accounts found</span>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => handleAccountSelect(account.accountId)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors",
            selectedAccountId === account.accountId
              ? "bg-primary/20 border border-primary/50"
              : "bg-white/5 hover:bg-white/10"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">
              {account.displayAccountId}
            </span>
            {selectedAccountId === account.accountId && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
          <span className="text-xs text-white/40">
            {new Date(account.linkedAt).toLocaleDateString()}
          </span>
        </button>
      ))}
    </div>
  )
}
