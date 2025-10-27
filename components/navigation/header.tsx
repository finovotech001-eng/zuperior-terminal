"use client"

import * as React from "react"
import Image, { StaticImageData } from "next/image"
import { Bell, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { SearchInput } from "@/components/forms/search-input"
import { IconButton } from "@/components/ui/icon-button"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { UserProfile } from "@/components/auth/user-profile"
import defaultLogo from "@/public/logo.png"

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  onMenuClick?: () => void
  showSearch?: boolean
  logo?: StaticImageData
}

const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  showSearch = true,
  className,
  ...props
}) => {
  return (
    <header
      className={cn(
        "flex items-center justify-between px-4 py-3",
        "bg-background border-b border-border",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        <IconButton size="md" variant="ghost" onClick={onMenuClick} className="lg:hidden">
          <Menu className="h-5 w-5" />
        </IconButton>

        <div className="flex items-center gap-3">
          <Image src={props?.logo ?? defaultLogo} alt="Zuperior logo" width={28} height={28} className="rounded-sm object-contain" priority />
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
            Zuperior
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <SearchInput placeholder="Search instruments..." />
        </div>
      )}

      <div className="flex items-center gap-2">
        <ThemeToggle />
        
        <IconButton size="md" variant="ghost">
          <Bell className="h-5 w-5" />
        </IconButton>

        <UserProfile />

        <Button size="sm" className="ml-2 bg-primary text-primary-foreground">
          Deposit
        </Button>
      </div>
    </header>
  )
}

export { Header }
