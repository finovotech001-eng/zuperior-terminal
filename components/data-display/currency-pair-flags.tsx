import * as React from "react"
import { cn } from "@/lib/utils"
import { FlagIcon } from "./flag-icon"

export interface CurrencyPairFlagsProps {
  symbol: string
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  fallbackCountryCode?: string | null
  fallbackIcon?: string | null
}

// Map currency codes to country codes
const currencyToCountry: Record<string, string> = {
  'EUR': 'EU',
  'GBP': 'GB',
  'USD': 'US',
  'JPY': 'JP',
  'CHF': 'CH',
  'CAD': 'CA',
  'AUD': 'AU',
  'NZD': 'NZ',
  'CNY': 'CN',
  'HKD': 'HK',
  'SGD': 'SG',
  'NOK': 'NO',
  'SEK': 'SE',
  'DKK': 'DK',
  'PLN': 'PL',
  'TRY': 'TR',
  'ZAR': 'ZA',
  'MXN': 'MX',
  'BRL': 'BR',
  'INR': 'IN',
  'KRW': 'KR',
}

// Crypto and commodity icons
const cryptoIcons: Record<string, string> = {
  'BTC': '₿', // Bitcoin symbol
  'ETH': 'Ξ', // Ethereum symbol
}

const commodityIcons: Record<string, string> = {
  'XAU': '🪙', // Gold coin
  'XAG': '🥈', // Silver medal
}

/**
 * Parse currency pair from symbol and return base/quote currencies
 */
function parseCurrencyPair(symbol: string): [string | null, string | null] {
  // Remove common suffixes like 'm' (micro/mini)
  const cleanSymbol = symbol.replace(/m$/i, '').toUpperCase()
  
  // Try to parse as currency pair (e.g., EURUSD, GBPUSD, BTCUSD)
  const patterns = [
    /^([A-Z]{3})([A-Z]{3})$/, // EURUSD
    /^([A-Z]{3})([A-Z]{3})M?$/, // EURUSDm
    /^([A-Z]{3,4})([A-Z]{3})$/, // BTCUSD, ETHUSD
  ]
  
  for (const pattern of patterns) {
    const match = cleanSymbol.match(pattern)
    if (match) {
      return [match[1], match[2]]
    }
  }
  
  return [null, null]
}

/**
 * CurrencyPairFlags component - displays overlapping circular flags for currency pairs
 */
export const CurrencyPairFlags: React.FC<CurrencyPairFlagsProps> = ({
  symbol,
  size = "sm",
  className,
  fallbackCountryCode,
  fallbackIcon,
}) => {
  const [baseCurrency, quoteCurrency] = parseCurrencyPair(symbol)
  
  // Size classes for the container
  const containerSizeClasses = {
    xs: "h-5 w-5",
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-8 w-8",
  }
  
  // Size classes for individual flags (circular)
  const flagSizeClasses = {
    xs: "h-4 w-4 text-[10px]",
    sm: "h-5 w-5 text-xs",
    md: "h-6 w-6 text-sm",
    lg: "h-7 w-7 text-base",
  }
  
  // If we have both currencies, show overlapping flags
  if (baseCurrency && quoteCurrency) {
    const baseCountry = currencyToCountry[baseCurrency]
    const quoteCountry = currencyToCountry[quoteCurrency]
    
    // Check if base is crypto
    if (cryptoIcons[baseCurrency]) {
      return (
        <div className={cn("relative inline-flex items-center justify-center", containerSizeClasses[size], className)}>
          {/* Crypto icon as background (circular) */}
          <div className={cn(
            "absolute top-0 left-0 rounded-full bg-orange-500/30 flex items-center justify-center border border-white/20",
            flagSizeClasses[size]
          )}>
            <span className="text-white font-bold">{cryptoIcons[baseCurrency]}</span>
          </div>
          {/* Quote currency flag overlapping bottom-right */}
          {quoteCountry && (
            <div className={cn(
              "absolute bottom-0 right-0 rounded-full overflow-hidden border-2 border-white/30 shadow-lg",
              flagSizeClasses[size]
            )}>
              <FlagIcon countryCode={quoteCountry} size={size} className="!h-full !w-full rounded-full !p-0" />
            </div>
          )}
        </div>
      )
    }
    
    // Check if base is commodity
    if (commodityIcons[baseCurrency]) {
      return (
        <div className={cn("relative inline-flex items-center justify-center", containerSizeClasses[size], className)}>
          {/* Commodity icon as background (circular) */}
          <div className={cn(
            "absolute top-0 left-0 rounded-full bg-yellow-500/30 flex items-center justify-center border border-white/20",
            flagSizeClasses[size]
          )}>
            <span className="text-base">{commodityIcons[baseCurrency]}</span>
          </div>
          {/* Quote currency flag overlapping bottom-right */}
          {quoteCountry && (
            <div className={cn(
              "absolute bottom-0 right-0 rounded-full overflow-hidden border-2 border-white/30 shadow-lg",
              flagSizeClasses[size]
            )}>
              <FlagIcon countryCode={quoteCountry} size={size} className="!h-full !w-full rounded-full !p-0" />
            </div>
          )}
        </div>
      )
    }
    
    // Regular currency pair - both flags overlapping
    if (baseCountry && quoteCountry) {
      return (
        <div className={cn("relative inline-flex items-center justify-center", containerSizeClasses[size], className)}>
          {/* Base currency flag (background, top-left, circular) */}
          <div className={cn(
            "absolute top-0 left-0 rounded-full overflow-hidden border-2 border-white/20",
            flagSizeClasses[size]
          )}>
            <FlagIcon countryCode={baseCountry} size={size} className="!h-full !w-full rounded-full !p-0" />
          </div>
          {/* Quote currency flag (foreground, bottom-right, overlapping, circular) */}
          <div className={cn(
            "absolute bottom-0 right-0 rounded-full overflow-hidden border-2 border-white/30 shadow-lg z-10",
            flagSizeClasses[size]
          )}>
            <FlagIcon countryCode={quoteCountry} size={size} className="!h-full !w-full rounded-full !p-0" />
          </div>
        </div>
      )
    }
  }
  
  // Fallback: single flag or icon
  if (baseCurrency) {
    const country = currencyToCountry[baseCurrency]
    if (country) {
      return (
        <div className={cn("relative inline-flex items-center justify-center", containerSizeClasses[size], className)}>
          <FlagIcon countryCode={country} size={size} className="!h-full !w-full rounded-full" />
        </div>
      )
    }
    
    // Crypto icon
    if (cryptoIcons[baseCurrency]) {
      return (
        <div className={cn(
          "relative inline-flex items-center justify-center rounded-full bg-orange-500/20",
          containerSizeClasses[size],
          className
        )}>
          <span className="text-white text-xs font-bold">{cryptoIcons[baseCurrency]}</span>
        </div>
      )
    }
    
    // Commodity icon
    if (commodityIcons[baseCurrency]) {
      return (
        <div className={cn(
          "relative inline-flex items-center justify-center rounded-full bg-yellow-500/20",
          containerSizeClasses[size],
          className
        )}>
          <span className="text-lg">{commodityIcons[baseCurrency]}</span>
        </div>
      )
    }
  }
  
  // No match - use fallback props if provided
  if (fallbackCountryCode) {
    return (
      <div className={cn("relative inline-flex items-center justify-center", containerSizeClasses[size], className)}>
        <FlagIcon countryCode={fallbackCountryCode} size={size} className="!h-full !w-full rounded-full" />
      </div>
    )
  }
  
  if (fallbackIcon) {
    return (
      <div className={cn("relative inline-flex items-center justify-center", containerSizeClasses[size], className)}>
        <span className="text-base">{fallbackIcon}</span>
      </div>
    )
  }
  
  // No match and no fallback - return empty
  return null
}

