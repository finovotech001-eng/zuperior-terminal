"use client"

import * as React from "react"
import { Toggle } from "@/components/ui/toggle"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function SettingsPanel() {
  const [showSignals, setShowSignals] = React.useState(false)
  const [showHMR, setShowHMR] = React.useState(true)
  const [showPriceAlerts, setShowPriceAlerts] = React.useState(true)
  const [showOpenPositions, setShowOpenPositions] = React.useState(true)
  const [showTPSL, setShowTPSL] = React.useState(false)
  const [showEconomicCalendar, setShowEconomicCalendar] = React.useState(true)
  
  const [highImpact, setHighImpact] = React.useState(true)
  const [middleImpact, setMiddleImpact] = React.useState(false)
  const [lowImpact, setLowImpact] = React.useState(false)
  const [lowestImpact, setLowestImpact] = React.useState(false)
  
  const [priceAlertSound, setPriceAlertSound] = React.useState(false)
  const [closingSound, setClosingSound] = React.useState(false)
  
  const [autoTPSL, setAutoTPSL] = React.useState(false)
  const [openOrderMode, setOpenOrderMode] = React.useState("regular")
  const [priceSource, setPriceSource] = React.useState("bid")
  const [appearance, setAppearance] = React.useState("dark")
  const [timezone, setTimezone] = React.useState("utc")

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto scrollbar-thin p-3">
        <div className="space-y-4">
          {/* Show on chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-sm font-medium text-white/80">Show on chart</h3>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="signals" className="text-sm text-white/80 cursor-pointer">Signals</Label>
                <Toggle id="signals" checked={showSignals} onCheckedChange={setShowSignals} />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="hmr" className="text-sm text-white/80 cursor-pointer">HMR periods</Label>
                <Toggle id="hmr" checked={showHMR} onCheckedChange={setShowHMR} />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="price-alerts" className="text-sm text-white/80 cursor-pointer">Price alerts</Label>
                <Toggle id="price-alerts" checked={showPriceAlerts} onCheckedChange={setShowPriceAlerts} />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="open-positions" className="text-sm text-white/80 cursor-pointer">Open positions</Label>
                <Toggle id="open-positions" checked={showOpenPositions} onCheckedChange={setShowOpenPositions} />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="tpsl" className="text-sm text-white/80 cursor-pointer">TP / SL / Stop / Limit</Label>
                <Toggle id="tpsl" checked={showTPSL} onCheckedChange={setShowTPSL} />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="economic-cal" className="text-sm text-white/80 cursor-pointer">Economic calendar</Label>
                <Toggle id="economic-cal" checked={showEconomicCalendar} onCheckedChange={setShowEconomicCalendar} />
              </div>

              {/* Economic calendar impact levels */}
              {showEconomicCalendar && (
                <div className="ml-4 mt-2 space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox id="high-impact" checked={highImpact} onCheckedChange={(checked) => setHighImpact(checked as boolean)} />
                    <Label htmlFor="high-impact" className="text-sm text-white/60 cursor-pointer">High impact</Label>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox id="middle-impact" checked={middleImpact} onCheckedChange={(checked) => setMiddleImpact(checked as boolean)} />
                    <Label htmlFor="middle-impact" className="text-sm text-white/60 cursor-pointer">Middle impact</Label>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox id="low-impact" checked={lowImpact} onCheckedChange={(checked) => setLowImpact(checked as boolean)} />
                    <Label htmlFor="low-impact" className="text-sm text-white/60 cursor-pointer">Low impact</Label>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox id="lowest-impact" checked={lowestImpact} onCheckedChange={(checked) => setLowestImpact(checked as boolean)} />
                    <Label htmlFor="lowest-impact" className="text-sm text-white/60 cursor-pointer">Lowest impact</Label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Sound effects */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-sm font-medium text-white/80">Sound effects</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="cursor-pointer">
                    <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enable or disable sound notifications</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="price-alert-sound" className="text-sm text-white/80 cursor-pointer">Price alerts</Label>
                <Toggle id="price-alert-sound" checked={priceAlertSound} onCheckedChange={setPriceAlertSound} />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="closing-sound" className="text-sm text-white/80 cursor-pointer">Closing by TP / SL / SO</Label>
                <Toggle id="closing-sound" checked={closingSound} onCheckedChange={setClosingSound} />
              </div>
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Trading settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-sm font-medium text-white/80">Trading settings</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="auto-tpsl" className="text-sm text-white/80 cursor-pointer">Set TP/SL automatically</Label>
                <Toggle id="auto-tpsl" checked={autoTPSL} onCheckedChange={setAutoTPSL} />
              </div>

              <div className="space-y-2 px-1">
                <Label htmlFor="order-mode" className="text-sm text-white/60">Open order mode</Label>
                <Select value={openOrderMode} onValueChange={setOpenOrderMode}>
                  <SelectTrigger id="order-mode" className="w-full bg-white/[0.02] border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular form</SelectItem>
                    <SelectItem value="one-click">One-click form</SelectItem>
                    <SelectItem value="risk-calculator">Risk calculator form</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 px-1">
                <Label htmlFor="price-source" className="text-sm text-white/60">Price source</Label>
                <Select value={priceSource} onValueChange={setPriceSource}>
                  <SelectTrigger id="price-source" className="w-full bg-white/[0.02] border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bid">Bid</SelectItem>
                    <SelectItem value="ask">Ask</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 px-1">
                <Label htmlFor="appearance" className="text-sm text-white/60">Appearance</Label>
                <Select value={appearance} onValueChange={setAppearance}>
                  <SelectTrigger id="appearance" className="w-full bg-white/[0.02] border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Always dark</SelectItem>
                    <SelectItem value="light">Always light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 px-1">
                <Label htmlFor="timezone" className="text-sm text-white/60">Time zone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone" className="w-full bg-white/[0.02] border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="est">EST</SelectItem>
                    <SelectItem value="pst">PST</SelectItem>
                    <SelectItem value="gmt">GMT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

