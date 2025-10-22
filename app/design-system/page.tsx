"use client"

import * as React from "react"
import {
  List,
  Calendar,
  Settings,
  Bell,
  Bitcoin,
} from "lucide-react"

// Component Sections
import { ComponentSection } from "@/components/design-system/component-section"
import { VariantGrid } from "@/components/design-system/variant-grid"
import { ShowcaseCard } from "@/components/design-system/showcase-card"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconButton } from "@/components/ui/icon-button"
import { Spinner } from "@/components/ui/spinner"
import { Toggle } from "@/components/ui/toggle"

// Form Components
import { NumberStepper } from "@/components/forms/number-stepper"
import { SearchInput } from "@/components/forms/search-input"
import { FilterDropdown } from "@/components/forms/filter-dropdown"

// Data Display Components
import { PriceDisplay } from "@/components/data-display/price-display"
import { StatsPanel } from "@/components/data-display/stats-panel"
import { FlagIcon } from "@/components/data-display/flag-icon"

// Trading Components
import { PriceTicker } from "@/components/trading/price-ticker"
import { PositionCard } from "@/components/trading/position-card"
import { OrderPanel } from "@/components/trading/order-panel"
import { InstrumentListItem } from "@/components/trading/instrument-list-item"
import { InstrumentList } from "@/components/trading/instrument-list"
import { PositionsTable } from "@/components/trading/positions-table"
import { PositionManagementPanel } from "@/components/trading/position-management-panel"
import { AccountSwitcher } from "@/components/trading/account-switcher"
import { BalanceDisplay } from "@/components/trading/balance-display"
import { EconomicCalendarEvent } from "@/components/trading/economic-calendar-event"
import { EconomicCalendar } from "@/components/trading/economic-calendar"

// Navigation Components
import { Header } from "@/components/navigation/header"
import { Sidebar } from "@/components/navigation/sidebar"
import { InstrumentTabs } from "@/components/navigation/instrument-tabs"

// Chart Components
import { ChartContainer } from "@/components/chart/chart-container"
import { DrawingToolbar } from "@/components/chart/drawing-toolbar"
import { ChartToolbar } from "@/components/chart/chart-toolbar"
import { TimeframeSelector } from "@/components/chart/timeframe-selector"

import { useSetAtom } from "jotai"
import { instrumentsAtom } from "@/lib/store"

export default function DesignSystemPage() {
  const [priceValue, setPriceValue] = React.useState(1.0850)
  const [previousPrice, setPreviousPrice] = React.useState(1.0850)
  const setInstruments = useSetAtom(instrumentsAtom)

  // Simulate price changes
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPreviousPrice(priceValue)
      setPriceValue((prev) => prev + (Math.random() - 0.5) * 0.001)
    }, 3000)
    return () => clearInterval(interval)
  }, [priceValue])

  interface MT5Account {
  id: string;
  accountId: string;
  displayAccountId: string;
  linkedAt: string; // ISO string or Date
  name: string;
  type: "demo" | "real";
  balance: number;
  number: string;
}

// Example:
  const accounts: MT5Account[] = [
    {
      id: "1",
      accountId: "MT50001",
      displayAccountId: "Demo 0001",
      linkedAt: new Date().toISOString(),
      name: "Demo Account 1",
      type: "demo",
      balance: 10000,
      number: "12345678",
    },
    {
      id: "2",
      accountId: "MT50002",
      displayAccountId: "Real 0001",
      linkedAt: new Date().toISOString(),
      name: "Real Account 1",
      type: "real",
      balance: 5000,
      number: "87654321",
    },
  ];


  const balanceInfo = {
    balance: 10000.00,
    equity: 8136.40,
    margin: 4349.70,
    freeMargin: 3786.70,
    marginLevel: 187.06,
    leverage: "1:200",
  }

  const sidebarItems = [
    { id: "instruments", icon: <List className="h-4 w-4" />, label: "Instruments", active: true },
    { id: "calendar", icon: <Calendar className="h-4 w-4" />, label: "Economic Calendar", active: false },
    { id: "settings", icon: <Settings className="h-4 w-4" />, label: "Settings", active: false },
  ]

  const instrumentTabs = [
    { id: "1", symbol: "EUR/USD", countryCode: "EU" },
    { id: "2", symbol: "BTC", icon: <Bitcoin className="h-4 w-4" /> },
    { id: "3", symbol: "US500", countryCode: "US" },
    { id: "4", symbol: "XAU/USD", countryCode: "US" },
  ]

  const economicEvent = {
    id: "1",
    time: "6:00 AM",
    title: "Unemployment Rate",
    country: "United Kingdom",
    countryCode: "GB",
    impact: "high" as const,
    actual: "4.8%",
    forecast: "4.7%",
    previous: "4.7%",
    description: "In the United Kingdom, the headline unemployment rate is the number of unemployed people (aged 16+) divided by the economically active population (aged 16+).",
  }

  const economicCalendarEvents = [
    {
      date: "2024-10-14",
      displayDate: "October 14",
      events: [
        {
          id: "1",
          time: "6:00 AM",
          title: "Unemployment Rate",
          country: "United Kingdom",
          countryCode: "GB",
          impact: "high" as const,
          actual: "4.8%",
          forecast: "4.7%",
          previous: "4.7%",
          description: "In the United Kingdom, the headline unemployment rate is the number of unemployed people (aged 16+) divided by the economically active population (aged 16+).",
        },
        {
          id: "2",
          time: "6:00 AM",
          title: "Employment Change",
          country: "United Kingdom",
          countryCode: "GB",
          impact: "high" as const,
          actual: "91K",
          forecast: "70K",
          previous: "232K",
          description: "Employment Change measures the change in the number of employed people during the previous month. Job creation is an important leading indicator of consumer spending, which accounts for a majority of overall economic activity.",
        },
        {
          id: "3",
          time: "6:00 AM",
          title: "Inflation Rate MoM Final",
          country: "Germany",
          countryCode: "DE",
          impact: "medium" as const,
          actual: "0.2%",
          forecast: "0.2%",
          previous: "0.1%",
          description: "Consumer prices measure the change in the prices paid by consumers for a basket of goods and services. Month-over-month changes show short-term price movements.",
        },
        {
          id: "4",
          time: "6:00 AM",
          title: "Average Earnings incl. Bonus (3Mo/Yr)",
          country: "United Kingdom",
          countryCode: "GB",
          impact: "medium" as const,
          actual: "5%",
          forecast: "4.6%",
          previous: "4.8%",
          description: "Average Earnings measures the change in the price businesses pay for labor, including bonuses. Higher wage growth can lead to inflationary pressures.",
        },
        {
          id: "5",
          time: "6:00 AM",
          title: "Inflation Rate YoY Final",
          country: "Germany",
          countryCode: "DE",
          impact: "low" as const,
          actual: "2.4%",
          forecast: "2.4%",
          previous: "2.2%",
        },
        {
          id: "6",
          time: "6:00 AM",
          title: "Harmonised Inflation Rate YoY Final",
          country: "Germany",
          countryCode: "DE",
          impact: "low" as const,
          actual: "2.4%",
          forecast: "2.4%",
          previous: "2.1%",
        },
        {
          id: "7",
          time: "8:30 AM",
          title: "Core Retail Sales MoM",
          country: "United States",
          countryCode: "US",
          impact: "high" as const,
          actual: "0.4%",
          forecast: "0.3%",
          previous: "0.3%",
          description: "Core Retail Sales measures the change in the total value of sales at the retail level, excluding automobiles. It's a key indicator of consumer spending, which accounts for the majority of overall economic activity.",
        },
        {
          id: "8",
          time: "8:30 AM",
          title: "Retail Sales MoM",
          country: "United States",
          countryCode: "US",
          impact: "high" as const,
          actual: "0.7%",
          forecast: "0.6%",
          previous: "1.0%",
          description: "Retail Sales measures the change in the total value of sales at the retail level. It's the primary gauge of consumer spending, which accounts for the majority of overall economic activity.",
        },
        {
          id: "9",
          time: "10:00 AM",
          title: "Business Inventories",
          country: "United States",
          countryCode: "US",
          impact: "low" as const,
          actual: "0.3%",
          forecast: "0.2%",
          previous: "0.2%",
        },
        {
          id: "10",
          time: "2:00 PM",
          title: "Fed Chair Powell Speech",
          country: "United States",
          countryCode: "US",
          impact: "high" as const,
          actual: "-",
          forecast: "-",
          previous: "-",
          description: "Federal Reserve Chair Jerome Powell's speeches can have significant impact on currency markets as they provide insights into monetary policy direction and economic outlook.",
        },
      ],
    },
    {
      date: "2024-10-15",
      displayDate: "October 15",
      events: [
        {
          id: "11",
          time: "2:00 AM",
          title: "Trade Balance",
          country: "China",
          countryCode: "CN",
          impact: "medium" as const,
          actual: "81.71B",
          forecast: "75.50B",
          previous: "91.02B",
          description: "Trade Balance measures the difference in value between imported and exported goods during the reported month. A positive number indicates that more goods were exported than imported.",
        },
        {
          id: "12",
          time: "2:00 AM",
          title: "Exports YoY",
          country: "China",
          countryCode: "CN",
          impact: "medium" as const,
          actual: "5.2%",
          forecast: "4.5%",
          previous: "2.4%",
          description: "Exports YoY measures the change in the total value of goods and services exported. Export demand and currency demand are directly linked because foreigners must buy the domestic currency to pay for the nation's exports.",
        },
        {
          id: "13",
          time: "5:00 AM",
          title: "GDP Growth Rate QoQ Final",
          country: "Eurozone",
          countryCode: "EU",
          impact: "high" as const,
          actual: "0.4%",
          forecast: "0.4%",
          previous: "0.3%",
          description: "Gross Domestic Product measures the total value of goods and services produced by the economy. It's the broadest measure of economic activity and the primary gauge of the economy's health.",
        },
        {
          id: "14",
          time: "5:00 AM",
          title: "Employment Change QoQ",
          country: "Eurozone",
          countryCode: "EU",
          impact: "low" as const,
          actual: "0.2%",
          forecast: "0.2%",
          previous: "0.3%",
        },
        {
          id: "15",
          time: "8:30 AM",
          title: "Building Permits",
          country: "United States",
          countryCode: "US",
          impact: "medium" as const,
          actual: "1.428M",
          forecast: "1.440M",
          previous: "1.470M",
          description: "Building Permits measures the change in the number of new building permits issued. It's a leading indicator of future construction activity, which drives employment and economic growth.",
        },
        {
          id: "16",
          time: "8:30 AM",
          title: "Housing Starts",
          country: "United States",
          countryCode: "US",
          impact: "medium" as const,
          actual: "1.354M",
          forecast: "1.350M",
          previous: "1.356M",
        },
        {
          id: "17",
          time: "9:15 AM",
          title: "Industrial Production MoM",
          country: "United States",
          countryCode: "US",
          impact: "medium" as const,
          actual: "-0.3%",
          forecast: "0.0%",
          previous: "0.3%",
          description: "Industrial Production measures the change in the total inflation-adjusted value of output produced by manufacturers, mines, and utilities. Manufacturing accounts for approximately 20% of overall GDP.",
        },
        {
          id: "18",
          time: "10:30 AM",
          title: "Crude Oil Inventories",
          country: "United States",
          countryCode: "US",
          impact: "low" as const,
          actual: "-2.157M",
          forecast: "-1.800M",
          previous: "1.635M",
          description: "Crude Oil Inventories measures the weekly change in the number of barrels of crude oil held in inventory by commercial firms. The level of inventories influences the price of petroleum products, which impacts inflation.",
        },
      ],
    },
    {
      date: "2024-10-16",
      displayDate: "October 16",
      events: [
        {
          id: "19",
          time: "12:30 AM",
          title: "Monetary Policy Statement",
          country: "Reserve Bank of Australia",
          countryCode: "AU",
          impact: "high" as const,
          actual: "-",
          forecast: "-",
          previous: "-",
          description: "The Monetary Policy Statement contains the outcome of the Reserve Bank's decision on interest rates and commentary on economic conditions that influenced their decision.",
        },
        {
          id: "20",
          time: "6:00 AM",
          title: "CPI YoY",
          country: "United Kingdom",
          countryCode: "GB",
          impact: "high" as const,
          actual: "2.6%",
          forecast: "2.5%",
          previous: "2.2%",
          description: "Consumer Price Index measures the change in the price of goods and services from the perspective of the consumer. It's a key way to measure changes in purchasing trends and inflation.",
        },
        {
          id: "21",
          time: "6:00 AM",
          title: "Core CPI YoY",
          country: "United Kingdom",
          countryCode: "GB",
          impact: "medium" as const,
          actual: "3.2%",
          forecast: "3.1%",
          previous: "3.3%",
        },
        {
          id: "22",
          time: "7:00 AM",
          title: "ZEW Economic Sentiment",
          country: "Germany",
          countryCode: "DE",
          impact: "medium" as const,
          actual: "13.1",
          forecast: "10.5",
          previous: "3.6",
          description: "The ZEW Economic Sentiment Index rates the relative 6-month economic outlook for Germany. A level above zero indicates optimism while a level below indicates pessimism.",
        },
        {
          id: "23",
          time: "8:30 AM",
          title: "Core PPI MoM",
          country: "United States",
          countryCode: "US",
          impact: "medium" as const,
          actual: "0.2%",
          forecast: "0.2%",
          previous: "0.3%",
        },
        {
          id: "24",
          time: "8:30 AM",
          title: "Unemployment Claims",
          country: "United States",
          countryCode: "US",
          impact: "medium" as const,
          actual: "241K",
          forecast: "260K",
          previous: "258K",
          description: "Unemployment Claims measures the number of individuals who filed for unemployment insurance for the first time during the past week. This is the earliest U.S. economic data, but the market impact varies from week to week.",
        },
        {
          id: "25",
          time: "10:00 AM",
          title: "Existing Home Sales",
          country: "United States",
          countryCode: "US",
          impact: "low" as const,
          actual: "3.96M",
          forecast: "3.90M",
          previous: "3.86M",
        },
        {
          id: "26",
          time: "10:30 AM",
          title: "Natural Gas Storage",
          country: "United States",
          countryCode: "US",
          impact: "low" as const,
          actual: "76B",
          forecast: "70B",
          previous: "69B",
        },
      ],
    },
  ]

  const statsData = [
    { label: "Total P/L", value: "-372.40 USD", change: -4.6, trend: "down" as const },
    { label: "Open Positions", value: "1", trend: "neutral" as const },
    { label: "Margin Used", value: "43.5%", change: 5.2, trend: "up" as const },
    { label: "Free Margin", value: "3,786 USD", trend: "neutral" as const },
  ]

  // Initialize instruments data only if empty (first load)
  

  // Sample data for PositionsTable
  const openPositions = [
    {
      id: "1",
      symbol: "XAU/USD",
      countryCode: "US" as const,
      type: "Sell" as const,
      volume: 2,
      openPrice: 4349.700,
      currentPrice: 4357.834,
      takeProfit: 4356.617,
      position: "147593271",
      openTime: "Oct 16, 11:04:57 PM",
      swap: 0,
      pnl: -1626.80,
    },
  ]
  
  const samplePosition = {
    id: "1",
    symbol: "XAU/USD",
    countryCode: "US" as const,
    type: "Sell" as const,
    lots: 2,
    openPrice: 4349.700,
    currentPrice: 4358.536,
    takeProfit: 4356.617,
    pnl: -1767.20,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Preview */}
      <Header />

      <div className="container mx-auto py-8 px-4 space-y-12">
        {/* Introduction */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-primary">
            Zuperior Design System
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            A comprehensive design system for professional trading terminals. Built with React, Tailwind CSS, 
            Framer Motion, and TradingView Lightweight Charts. All components are fully typed with TypeScript 
            and follow modern accessibility standards.
          </p>
        </div>

        {/* Color Palette */}
        <ComponentSection
          title="Color Palette"
          description="Zuperior brand colors optimized for trading interfaces"
        >
          <VariantGrid cols={5}>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-primary" />
              <p className="text-sm font-medium">Primary</p>
              <p className="text-xs text-muted-foreground">#8B5CF6</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-success" />
              <p className="text-sm font-medium">Success/Profit</p>
              <p className="text-xs text-muted-foreground">#16A34A</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-danger" />
              <p className="text-sm font-medium">Danger/Loss</p>
              <p className="text-xs text-muted-foreground">#EF4444</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-info" />
              <p className="text-sm font-medium">Info</p>
              <p className="text-xs text-muted-foreground">#3B82F6</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-warning" />
              <p className="text-sm font-medium">Warning</p>
              <p className="text-xs text-muted-foreground">#F59E0B</p>
            </div>
          </VariantGrid>
        </ComponentSection>

        <Separator />

        {/* Typography */}
        <ComponentSection
          title="Typography"
          description="Manrope for UI text, JetBrains Mono for numbers and prices"
        >
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h1 className="text-4xl font-bold">Heading 1 - Manrope</h1>
                <p className="text-muted-foreground">48px / Bold / Display</p>
              </div>
              <div>
                <h2 className="text-3xl font-bold">Heading 2 - Manrope</h2>
                <p className="text-muted-foreground">36px / Bold / Titles</p>
              </div>
              <div>
                <p className="text-base">Body text in Manrope font. Clean and modern.</p>
                <p className="text-muted-foreground">16px / Regular / Body</p>
              </div>
              <div>
                <p className="text-2xl price-font font-bold">1,234.56789</p>
                <p className="text-muted-foreground">JetBrains Mono / Prices & Numbers</p>
              </div>
            </CardContent>
          </Card>
        </ComponentSection>

        <Separator />

        {/* Atomic Components */}
        <ComponentSection
          title="Atomic Components"
          description="15+ foundational UI components with Framer Motion animations"
        >
          <VariantGrid cols={2}>
            <ShowcaseCard title="Buttons" description="7 variants with hover/tap animations">
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="glass">Glass</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="success">Success</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="link">Link</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Icon Buttons" description="Circular buttons for toolbars">
              <div className="flex flex-wrap gap-2">
                <IconButton variant="default">
                  <List className="h-4 w-4" />
                </IconButton>
                <IconButton variant="primary">
                  <Calendar className="h-4 w-4" />
                </IconButton>
                <IconButton variant="danger">
                  <Bell className="h-4 w-4" />
                </IconButton>
                <IconButton variant="ghost">
                  <Settings className="h-4 w-4" />
                </IconButton>
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Inputs" description="Text and number inputs with states">
              <div className="w-full space-y-2">
                <Label>Text Input</Label>
                <Input placeholder="Enter text..." />
                <Input type="number" placeholder="123.45" className="price-font" />
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Badges" description="Status and info indicators">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="glass">Glass</Badge>
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Toggle Switch" description="Animated iOS-style switch">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Toggle />
                  <Label>Enable notifications</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked />
                  <Label>Auto-trading</Label>
                </div>
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Loading States" description="Spinners for async operations">
              <div className="flex items-center gap-4">
                <Spinner size="sm" />
                <Spinner size="md" />
                <Spinner size="lg" />
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Progress Bar" description="Show completion status">
              <div className="w-full space-y-3">
                <Progress value={33} />
                <Progress value={66} />
                <Progress value={100} />
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Slider" description="Range input control">
              <div className="w-full">
                <Slider defaultValue={[50]} max={100} step={1} />
              </div>
            </ShowcaseCard>
          </VariantGrid>
        </ComponentSection>

        <Separator />

        {/* Form Components */}
        <ComponentSection
          title="Form & Control Components"
          description="Specialized form inputs for trading operations"
        >
          <VariantGrid cols={2}>
            <ShowcaseCard title="Number Stepper" description="Lot size and volume control">
              <NumberStepper
                value={2.5}
                min={0.01}
                max={100}
                step={0.01}
                precision={2}
              />
            </ShowcaseCard>

            <ShowcaseCard title="Search Input" description="Search with clear button">
              <SearchInput placeholder="Search instruments..." className="w-full" />
            </ShowcaseCard>

            <ShowcaseCard title="Filter Dropdown" description="Multi-level filtering">
              <FilterDropdown
                options={[
                  { label: "All impacts", value: "all" },
                  { label: "High impact", value: "high" },
                  { label: "Medium impact", value: "medium" },
                  { label: "Low impact", value: "low" },
                ]}
                placeholder="Select impact"
                className="w-full"
              />
            </ShowcaseCard>
          </VariantGrid>
        </ComponentSection>

        <Separator />

        {/* Data Display Components */}
        <ComponentSection
          title="Data Display Components"
          description="Components for showing prices, stats, and market data"
        >
          <VariantGrid cols={2}>
            <ShowcaseCard title="Price Display" description="Animated price changes">
              <PriceDisplay
                value={priceValue}
                previousValue={previousPrice}
                precision={5}
                size="lg"
              />
            </ShowcaseCard>

            <ShowcaseCard title="Flag Icons" description="Country flags for currency pairs">
              <div className="flex gap-3">
                <FlagIcon countryCode="US" size="lg" />
                <FlagIcon countryCode="EU" size="lg" />
                <FlagIcon countryCode="GB" size="lg" />
                <FlagIcon countryCode="JP" size="lg" />
                <FlagIcon countryCode="CN" size="lg" />
              </div>
            </ShowcaseCard>
          </VariantGrid>

          <Card>
            <CardHeader>
              <CardTitle>Stats Panel</CardTitle>
              <CardDescription>Key metrics dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <StatsPanel stats={statsData} columns={4} />
            </CardContent>
          </Card>
        </ComponentSection>

        <Separator />

        {/* Trading Components */}
        <ComponentSection
          title="Trading-Specific Components"
          description="13 specialized components for trading operations including drag & drop lists and position management"
        >
          <VariantGrid >
            <ShowcaseCard title="Price Ticker" description="Real-time price streaming" className="col-span-2">
              <PriceTicker
                symbol="EUR/USD"
                bid={1.0848}
                ask={1.0850}
                change={-0.0012}
                changePercent={-0.11}
                className="w-full"
              />
            </ShowcaseCard>

            <ShowcaseCard title="Instrument List Item" description="Symbol row with signals" className="col-span-2">
              <div className="w-full space-y-2 overflow-x-auto">
                <InstrumentListItem
                  symbol="EUR/USD"
                  signal="up"
                  bid={1.0848}
                  ask={1.0850}
                  changePercent1d={0.11}
                  pnl={24.50}
                  isFavorite={true}
                  showDragHandle={true}
                />
                <InstrumentListItem
                  symbol="GBP/USD"
                  signal="down"
                  bid={1.2645}
                  ask={1.2647}
                  changePercent1d={-0.06}
                  pnl={-15.30}
                  isFavorite={false}
                  showDragHandle={true}
                />
                <InstrumentListItem
                  symbol="XAU/USD"
                  signal="up"
                  bid={2034.25}
                  ask={2034.75}
                  changePercent1d={1.45}
                  isFavorite={true}
                  showDragHandle={true}
                />
              </div>
            </ShowcaseCard>
          </VariantGrid>

          <VariantGrid cols={4}>
            <ShowcaseCard title="Position Card" description="Open position display" className="col-span-1">
              <PositionCard
                symbol="XAU/USD"
                type="sell"
                volume={2}
                openPrice={4349.700}
                currentPrice={4351.562}
                profit={-372.40}
                profitPercent={-4.3}
                className="w-full"
              />
            </ShowcaseCard>

            <ShowcaseCard title="Order Panel" description="Buy/Sell order form" className="flex items-start justify-center">
              <OrderPanel
                className="w-full"
                symbol="XAU/USD"
                countryCode="US"
                sellPrice={4354.896}
                buyPrice={4355.056}
                spread="0.16 USD"
              />
            </ShowcaseCard>
            
            <ShowcaseCard title="Account Switcher" description="Demo/Real account selector">
              <AccountSwitcher
                accounts={accounts}
                currentAccountId="1"
                className="w-full"
              />
            </ShowcaseCard>

            <ShowcaseCard title="Balance Display" description="Account metrics panel">
              <BalanceDisplay
                balanceInfo={balanceInfo}
                className="w-full"
              />
            </ShowcaseCard>
          </VariantGrid>
          <VariantGrid cols={4}>
            <ShowcaseCard title="Economic Calendar Event" description="Single news event card" className="!col-span-3">
              <div className="w-full glass-card rounded-md overflow-hidden">
            <EconomicCalendarEvent
              event={economicEvent}
                />
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Economic Calendar" description="Full economic calendar with date grouping">
              <EconomicCalendar
                eventsByDate={economicCalendarEvents}
                showHeaders={true}
                maxHeight="600px"
              className="w-full"
            />
          </ShowcaseCard>
          </VariantGrid>
          <ShowcaseCard title="Instrument List" description="Compact drag & drop sortable list with favorites">
            <div className="w-full glass-card rounded-md overflow-hidden">
              <InstrumentList
                onSelectInstrument={(id: string) => console.log('Select instrument:', id)}
              />
            </div>
          </ShowcaseCard>
          <VariantGrid cols={6}>
            <ShowcaseCard title="Positions Table" description="Full-featured positions management table" className="col-span-4">
            <div className="w-full h-[400px]">
              <PositionsTable
                openPositions={openPositions}
                pendingPositions={[]}
                closedPositions={[]}
                onClose={(id) => console.log('Close:', id)}
              />
            </div>
          </ShowcaseCard>

            <ShowcaseCard title="Position Management Panel" description="Modify, partial close, and close by panel" className="col-span-2">
            <div className="flex justify-center">
              <PositionManagementPanel
                position={samplePosition}
                onClose={() => console.log('Close panel')}
                onModify={(data) => console.log('Modify:', data)}
                onPartialClose={(volume) => console.log('Partial close:', volume)}
              />
            </div>
          </ShowcaseCard>
          </VariantGrid>
        </ComponentSection>

        <Separator />

        {/* Navigation Components */}
        <ComponentSection
          title="Navigation Components"
          description="Header, sidebar, and tab navigation"
        >
          <ShowcaseCard title="Instrument Tabs" description="Trading pair tabs">
            <InstrumentTabs
              tabs={instrumentTabs}
              activeTabId="1"
              onTabChange={(id) => console.log("Tab changed:", id)}
              onTabClose={(id) => console.log("Tab closed:", id)}
              onAddTab={(instrumentId) => console.log("Add tab:", instrumentId)}
              className="w-full"
            />
          </ShowcaseCard>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <ShowcaseCard title="Sidebar" description="Vertical navigation" className="lg:col-span-1">
              <div className="h-64 w-full">
                <Sidebar items={sidebarItems} />
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Tabs Component" description="Content organization" className="lg:col-span-3">
              <Tabs defaultValue="open" className="w-full">
                <TabsList>
                  <TabsTrigger value="open">Open</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="closed">Closed</TabsTrigger>
                </TabsList>
                <TabsContent value="open" className="space-y-2">
                  <p className="text-sm text-muted-foreground">Open positions content</p>
                </TabsContent>
                <TabsContent value="pending">
                  <p className="text-sm text-muted-foreground">Pending orders content</p>
                </TabsContent>
                <TabsContent value="closed">
                  <p className="text-sm text-muted-foreground">Closed positions content</p>
                </TabsContent>
              </Tabs>
            </ShowcaseCard>
          </div>
        </ComponentSection>

        <Separator />

        {/* Chart Components */}
        <ComponentSection
          title="Enterprise Trading Chart"
          description="Professional Lightweight Charts with full drawing tools and controls, styled perfectly with Zuperior branding"
        >
          <Card>
            <CardHeader>
              <CardTitle>Professional Trading Chart - Exness Style</CardTitle>
              <CardDescription>
                TradingView Lightweight Charts with exact Exness layout. Features: Compact top bar with symbol/price info and zoom controls, Left vertical toolbar with drawing tools (trendlines, horizontal lines, shapes, text), Clean candlestick chart (no volume), Bottom timeframe selector (1D to All) with smooth animations. Perfectly integrated with Zuperior design system: Dark background (#01040D), Success Green (#16A34A), Danger Red (#EF4444), Purple crosshair (#8B5CF6), Manrope font.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer symbol="EURUSD" height={700} className="w-full" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Bitcoin Chart</CardTitle>
                <CardDescription>Cryptocurrency example</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ChartContainer symbol="BTCUSD" interval="60" height={400} className="w-full" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gold Chart</CardTitle>
                <CardDescription>Commodities example</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ChartContainer symbol="OANDA:XAUUSD" interval="240" height={400} className="w-full" />
              </CardContent>
            </Card>
          </div>

          {/* Legacy Toolbars for reference */}
          <div className="mt-8 space-y-4">
            <ShowcaseCard title="Chart Toolbars" description="Legacy toolbar components">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Drawing Toolbar</p>
                  <DrawingToolbar />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Chart Controls</p>
                  <ChartToolbar />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Timeframe Selector</p>
                  <TimeframeSelector />
                </div>
              </div>
            </ShowcaseCard>
          </div>
        </ComponentSection>

        {/* Footer */}
        <div className="pt-8 pb-4 text-center text-sm text-muted-foreground">
          <p>Zuperior Design System • Built with Next.js 15, React 19, Tailwind CSS v4</p>
          <p className="mt-1">© 2025 Zuperior. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

