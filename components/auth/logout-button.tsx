"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

interface LogoutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  children?: React.ReactNode
}

export function LogoutButton({ 
  variant = "ghost", 
  size = "default",
  className,
  children 
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setIsLoading(true)

    try {
      // Clear local caches before logging out
      try {
        const keys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && (k.startsWith('zuperior-positions-cache:'))) keys.push(k)
        }
        keys.forEach(k => localStorage.removeItem(k))
      } catch {}

      const response = await fetch("/apis/auth/logout", {
        method: "POST",
      })

      if (response.ok) {
        // Redirect to login page
        router.push("/")
      } else {
        console.error("Logout failed")
      }
    } catch (error) {
      console.error("Error during logout:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
    >
      {children || (
        <>
          <LogOut className="h-4 w-4 mr-2" />
          {isLoading ? "Logging out..." : "Logout"}
        </>
      )}
    </Button>
  )
}

