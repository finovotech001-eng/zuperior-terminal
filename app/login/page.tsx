"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  // Check for auto-login on mount
  React.useEffect(() => {
    const handleAutoLogin = async () => {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')
      const clientId = params.get('clientId')
      const autoLogin = params.get('autoLogin')

      if (autoLogin === 'true' && token && clientId) {
        setIsLoading(true)
        
        try {
          const response = await fetch("/apis/auth/sso-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, clientId }),
          })

          const data = await response.json()

          if (data.success) {
            // Store user data in localStorage
            if (data.user) {
              if (data.user.name) {
                localStorage.setItem('userName', data.user.name)
              }
              if (data.user.email) {
                localStorage.setItem('userEmail', data.user.email)
              }
            }
            // Redirect to terminal on successful login
            window.location.href = "/terminal"
          } else {
            setError(data.message || "Auto-login failed. Please login manually.")
          }
        } catch {
          setError("Auto-login error. Please login manually.")
        } finally {
          setIsLoading(false)
        }
      }
    }

    handleAutoLogin()
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/apis/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        // Store user data in localStorage
        if (data.user) {
          if (data.user.name) {
            localStorage.setItem('userName', data.user.name)
          }
          if (data.user.email) {
            localStorage.setItem('userEmail', data.user.email)
          }
        }
        // Redirect to terminal on successful login
        window.location.href = "/terminal"
      } else {
        setError(data.message || "Login failed. Please try again.")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Check if auto-login is in progress
  const isAutoLogin = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('autoLogin') === 'true';
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 bg-[#01040D]">
        <div className="container mx-auto px-6 py-4">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold gradient-text">Zuperior</h1>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Show loading state during auto-login */}
          {isAutoLogin && isLoading ? (
            <div className="text-center space-y-4">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <h2 className="text-2xl font-bold text-white">Logging you in...</h2>
              <p className="text-white/60">Please wait while we authenticate your session</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
                <p className="text-white/60">Sign in to your Zuperior account</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Sign In Form */}
              <form onSubmit={handleSignIn} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Your email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

                <Button type="submit" className="!w-full" size="lg" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Continue"}
                </Button>

                <div className="text-center">
                  <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80 transition-colors">
                    I forgot my password
                  </Link>
                </div>
              </form>

              <div className="mt-8 text-center">
                <p className="text-white/60 text-sm">
                  Don't have an account?{" "}
                  <Link href="/" className="text-primary hover:text-primary/80 transition-colors">
                    Create one here
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/8 bg-[#01040D]/50">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-xs text-white/60">© 2008-2025, Zuperior</p>
          </div>
        </div>
      </footer>
    </div>
  )
}