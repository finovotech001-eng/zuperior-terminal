"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { Toggle } from "@/components/ui/toggle"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { settingsAtom } from "@/lib/store"

export function SettingsPanel() {
  const [settings, setSettings] = useAtom(settingsAtom)
  
  // Helper to update a single setting
  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

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
                <Label htmlFor="show-on-chart" className="text-sm text-white/80 cursor-pointer">Show on chart</Label>
                <Toggle 
                  id="show-on-chart" 
                  checked={settings.showOnChart} 
                  onCheckedChange={(checked) => updateSetting('showOnChart', checked as boolean)} 
                />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="signals" className="text-sm text-white/80 cursor-pointer">Signals</Label>
                <Toggle 
                  id="signals" 
                  checked={settings.showSignals && settings.showOnChart} 
                  onCheckedChange={(checked) => updateSetting('showSignals', checked as boolean)}
                  disabled={!settings.showOnChart}
                />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="hmr" className="text-sm text-white/80 cursor-pointer">HMR periods</Label>
                <Toggle 
                  id="hmr" 
                  checked={settings.showHMR && settings.showOnChart} 
                  onCheckedChange={(checked) => updateSetting('showHMR', checked as boolean)}
                  disabled={!settings.showOnChart}
                />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="price-alerts" className="text-sm text-white/80 cursor-pointer">Price alerts</Label>
                <Toggle 
                  id="price-alerts" 
                  checked={settings.showPriceAlerts && settings.showOnChart} 
                  onCheckedChange={(checked) => updateSetting('showPriceAlerts', checked as boolean)}
                  disabled={!settings.showOnChart}
                />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="open-positions" className="text-sm text-white/80 cursor-pointer">Open positions</Label>
                <Toggle 
                  id="open-positions" 
                  checked={settings.showOpenPositions && settings.showOnChart} 
                  onCheckedChange={(checked) => updateSetting('showOpenPositions', checked as boolean)}
                  disabled={!settings.showOnChart}
                />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="tpsl" className="text-sm text-white/80 cursor-pointer">TP / SL / Stop / Limit</Label>
                <Toggle 
                  id="tpsl" 
                  checked={settings.showTPSL && settings.showOnChart} 
                  onCheckedChange={(checked) => updateSetting('showTPSL', checked as boolean)}
                  disabled={!settings.showOnChart}
                />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="economic-cal" className="text-sm text-white/80 cursor-pointer">Economic calendar</Label>
                <Toggle 
                  id="economic-cal" 
                  checked={settings.showEconomicCalendar && settings.showOnChart} 
                  onCheckedChange={(checked) => updateSetting('showEconomicCalendar', checked as boolean)}
                  disabled={!settings.showOnChart}
                />
              </div>

              {/* Economic calendar impact levels */}
              {settings.showEconomicCalendar && settings.showOnChart && (
                <div className="ml-4 mt-2 space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox 
                      id="high-impact" 
                      checked={settings.economicCalendarHighImpact} 
                      onCheckedChange={(checked) => updateSetting('economicCalendarHighImpact', checked as boolean)} 
                    />
                    <Label htmlFor="high-impact" className="text-sm text-white/60 cursor-pointer">High impact</Label>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox 
                      id="middle-impact" 
                      checked={settings.economicCalendarMiddleImpact} 
                      onCheckedChange={(checked) => updateSetting('economicCalendarMiddleImpact', checked as boolean)} 
                    />
                    <Label htmlFor="middle-impact" className="text-sm text-white/60 cursor-pointer">Middle impact</Label>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox 
                      id="low-impact" 
                      checked={settings.economicCalendarLowImpact} 
                      onCheckedChange={(checked) => updateSetting('economicCalendarLowImpact', checked as boolean)} 
                    />
                    <Label htmlFor="low-impact" className="text-sm text-white/60 cursor-pointer">Low impact</Label>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Checkbox 
                      id="lowest-impact" 
                      checked={settings.economicCalendarLowestImpact} 
                      onCheckedChange={(checked) => updateSetting('economicCalendarLowestImpact', checked as boolean)} 
                    />
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
                <Toggle 
                  id="price-alert-sound" 
                  checked={settings.priceAlertSound} 
                  onCheckedChange={(checked) => updateSetting('priceAlertSound', checked as boolean)} 
                />
              </div>
              
              <div className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-md transition-colors">
                <Label htmlFor="closing-sound" className="text-sm text-white/80 cursor-pointer">Closing by TP / SL / SO</Label>
                <Toggle 
                  id="closing-sound" 
                  checked={settings.closingSound} 
                  onCheckedChange={(checked) => updateSetting('closingSound', checked as boolean)} 
                />
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
                <Toggle 
                  id="auto-tpsl" 
                  checked={settings.autoTPSL} 
                  onCheckedChange={(checked) => updateSetting('autoTPSL', checked as boolean)} 
                />
              </div>

              <div className="space-y-2 px-1">
                <Label htmlFor="order-mode" className="text-sm text-white/60">Open order mode</Label>
                <Select 
                  value={settings.openOrderMode} 
                  onValueChange={(value) => updateSetting('openOrderMode', value as 'regular' | 'one-click' | 'risk-calculator')}
                >
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
                <Select 
                  value={settings.priceSource} 
                  onValueChange={(value) => updateSetting('priceSource', value as 'bid' | 'ask' | 'mid')}
                >
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
                <Select 
                  value={settings.appearance} 
                  onValueChange={(value) => updateSetting('appearance', value as 'dark' | 'light' | 'system')}
                >
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
                <Select 
                  value={settings.timezone} 
                  onValueChange={(value) => updateSetting('timezone', value as 'utc' | 'est' | 'pst' | 'gmt')}
                >
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

