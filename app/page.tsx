"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export default function Home() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [signInEmail, setSignInEmail] = React.useState("")
  const [signInPassword, setSignInPassword] = React.useState("")
  const [signUpEmail, setSignUpEmail] = React.useState("")
  const [signUpPassword, setSignUpPassword] = React.useState("")
  const [signUpName, setSignUpName] = React.useState("")
  const [agreeToTerms, setAgreeToTerms] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  // Password validation
  const hasMinLength = signUpPassword.length >= 8 && signUpPassword.length <= 15
  const hasUpperAndLower = /[A-Z]/.test(signUpPassword) && /[a-z]/.test(signUpPassword)
  const hasNumber = /\d/.test(signUpPassword)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(signUpPassword)
  const passwordScore = [hasMinLength, hasUpperAndLower, hasNumber, hasSpecialChar].filter(Boolean).length

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/apis/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signInEmail, password: signInPassword }),
      })

      const data = await response.json()

      if (data.success) {
        // Store MT5 account ID if available (for backward compatibility)
        if (data.mt5Account && data.mt5Account.accountId) {
          localStorage.setItem("accountId", data.mt5Account.accountId);
        }

        // Redirect to terminal on successful login
        window.location.href = "/terminal"
      } else {
        setError(data.message || "Login failed. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!agreeToTerms) {
      setError("Please agree to the terms and conditions.")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/apis/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: signUpEmail, 
          password: signUpPassword,
          name: signUpName 
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Redirect to terminal on successful registration
        window.location.href = "/terminal"
      } else {
        setError(data.message || "Registration failed. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

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
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome to Zuperior</h2>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="w-full mb-8 h-12">
              <TabsTrigger value="signin" className="flex-1 text-base">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1 text-base">Create an account</TabsTrigger>
            </TabsList>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Sign In Form */}
            <TabsContent value="signin" className="space-y-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Your email address</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
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
            </TabsContent>

            {/* Sign Up Form */}
            <TabsContent value="signup" className="space-y-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Your name (optional)</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="Enter your name"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Your email address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
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

                  {/* Password Requirements */}
                  {signUpPassword && (
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", hasMinLength ? "text-success" : "text-white/20")} />
                        <span className={cn(hasMinLength ? "text-white/80" : "text-white/40")}>
                          Between 8-15 characters
                        </span>
                        <span className="ml-auto text-white/40">{passwordScore}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", hasUpperAndLower ? "text-success" : "text-white/20")} />
                        <span className={cn(hasUpperAndLower ? "text-white/80" : "text-white/40")}>
                          At least one upper and one lower case letter
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", hasNumber ? "text-success" : "text-white/20")} />
                        <span className={cn(hasNumber ? "text-white/80" : "text-white/40")}>
                          At least one number
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", hasSpecialChar ? "text-success" : "text-white/20")} />
                        <span className={cn(hasSpecialChar ? "text-white/80" : "text-white/40")}>
                          At least one special character
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <details className="group">
                  <summary className="text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors list-none flex items-center gap-2">
                    <span>Partner code (optional)</span>
                    <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="mt-2">
                    <Input placeholder="Enter partner code" />
                  </div>
                </details>

                <div className="flex items-start gap-2 pt-2">
                  <Checkbox
                    id="terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                    disabled={isLoading}
                  />
                  <label htmlFor="terms" className="text-sm text-white/80 leading-tight cursor-pointer">
                    I declare and confirm that I am not a citizen or resident of the US for tax purposes.
                  </label>
                </div>

                <Button 
                  type="submit" 
                  className="!w-full" 
                  size="lg" 
                  disabled={!agreeToTerms || isLoading || passwordScore < 4}
                >
                  {isLoading ? "Creating account..." : "Continue"}
                </Button>

                <p className="text-xs text-center text-white/60">
                  By proceeding, you confirm that you have read and agree to the{" "}
                  <Link href="/privacy" className="text-primary hover:text-primary/80">
                    Privacy Policy
                  </Link>
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/8 bg-[#01040D]/50">
        <div className="container mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4 text-xs text-white/60 leading-relaxed">
              <p>
                Zuperior does not offer services to residents of certain jurisdictions including the USA, Iran, North Korea, the European Union,
                the United Kingdom and others. The content of the website including translations should not be construed as meaning for
                solicitation. Investors make their own and independent decisions.
              </p>
              <p>
                Trading in CFDs and generally leveraged products involves substantial risk of loss and you may lose all of your invested capital.
              </p>
              <p>
                Zuperior (SC) Ltd is a Securities Dealer registered in Seychelles with registration number 8423606-1 and authorised by the
                Financial Services Authority (FSA) with licence number SD025. The registered office of Zuperior (SC) Ltd is at 9A CT House,
                2nd floor, Providence, Mahe, Seychelles.
              </p>
            </div>

            <div className="flex flex-col md:items-end gap-4">
              <div className="flex flex-wrap gap-4 text-xs">
                <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">
                  Privacy Agreement
                </Link>
                <Link href="/risk" className="text-primary hover:text-primary/80 transition-colors">
                  Risk disclosure
                </Link>
                <Link href="/aml" className="text-primary hover:text-primary/80 transition-colors">
                  Preventing money laundering
                </Link>
                <Link href="/security" className="text-primary hover:text-primary/80 transition-colors">
                  Security instructions
                </Link>
                <Link href="/legal" className="text-primary hover:text-primary/80 transition-colors">
                  Legal documents
                </Link>
                <Link href="/complaints" className="text-primary hover:text-primary/80 transition-colors">
                  Complaints Handling Policy
                </Link>
              </div>
              <p className="text-xs text-white/60">© 2008-2025, Zuperior</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
