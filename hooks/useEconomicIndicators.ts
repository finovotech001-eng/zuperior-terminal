"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

interface ApiEconomicIndicator {
  // Support both PascalCase (from API) and camelCase
  id?: string
  Id?: string
  name?: string
  Name?: string
  country?: string
  Country?: string
  currency?: string
  Currency?: string
  category?: string
  Category?: string
  subcategory?: string
  Subcategory?: string
  unit?: string
  Unit?: string
  frequency?: string
  Frequency?: string
  currentValue?: string | null
  CurrentValue?: string | null
  lastUpdate?: string | null
  LastUpdate?: string | null
  dataSource?: string
  DataSource?: string
  isImportant?: boolean
  IsImportant?: boolean
}

export interface EconomicIndicator {
  id: string
  name: string
  country: string
  currency: string
  category: string
  subcategory?: string
  unit: string
  frequency: string
  currentValue: string | null
  lastUpdate: string | null
  dataSource: string
  isImportant: boolean
}

interface UseEconomicIndicatorsOptions {
  country?: string
  category?: string
  limit?: number
  enabled?: boolean
}

interface UseEconomicIndicatorsReturn {
  indicators: EconomicIndicator[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Transform API indicator to component format
 */
function transformIndicator(apiIndicator: ApiEconomicIndicator): EconomicIndicator | null {
  // Handle both PascalCase (from API) and camelCase field names
  const indicatorId = apiIndicator.id || apiIndicator.Id || `indicator-${Math.random()}`
  const indicatorName = apiIndicator.name || apiIndicator.Name || 'Untitled Indicator'
  
  if (!indicatorId || !indicatorName || indicatorName === 'Untitled Indicator') {
    console.warn('[Economic Indicators] Skipping indicator with missing required fields:', {
      id: apiIndicator.id || apiIndicator.Id,
      name: apiIndicator.name || apiIndicator.Name,
      fullIndicator: apiIndicator
    })
    return null
  }

  // Extract fields with fallback to both naming conventions
  const country = apiIndicator.country || apiIndicator.Country || 'Unknown'
  const currency = apiIndicator.currency || apiIndicator.Currency || 'USD'
  const category = apiIndicator.category || apiIndicator.Category || 'General'
  const subcategory = apiIndicator.subcategory || apiIndicator.Subcategory
  const unit = apiIndicator.unit || apiIndicator.Unit || ''
  const frequency = apiIndicator.frequency || apiIndicator.Frequency || 'Monthly'
  const currentValue = apiIndicator.currentValue !== undefined ? apiIndicator.currentValue : 
                      (apiIndicator.CurrentValue !== undefined ? apiIndicator.CurrentValue : null)
  const lastUpdate = apiIndicator.lastUpdate || apiIndicator.LastUpdate || null
  const dataSource = apiIndicator.dataSource || apiIndicator.DataSource || 'Unknown'
  const isImportant = apiIndicator.isImportant !== undefined ? apiIndicator.isImportant : 
                     (apiIndicator.IsImportant !== undefined ? apiIndicator.IsImportant : false)
  
  return {
    id: indicatorId,
    name: indicatorName,
    country: country,
    currency: currency,
    category: category,
    subcategory: subcategory,
    unit: unit,
    frequency: frequency,
    currentValue: currentValue,
    lastUpdate: lastUpdate,
    dataSource: dataSource,
    isImportant: isImportant,
  }
}

export function useEconomicIndicators({
  country,
  category,
  limit = 20,
  enabled = true,
}: UseEconomicIndicatorsOptions = {}): UseEconomicIndicatorsReturn {
  const [indicators, setIndicators] = useState<EconomicIndicator[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchIndicators = useCallback(async () => {
    if (!enabled) return
    
    setIsLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Get AccountId from localStorage or context
      const accountId = typeof window !== 'undefined' ? localStorage.getItem('accountId') : null
      if (!accountId) {
        console.warn('[Economic Indicators] No AccountId found, indicators may not work')
      }

      // Build query parameters (include accountId)
      const params = new URLSearchParams()
      if (accountId) params.append('accountId', accountId)
      if (country) params.append('country', country)
      if (category) params.append('category', category)
      if (limit) params.append('limit', limit.toString())

      const url = `/apis/economy/indicators${params.toString() ? '?' + params.toString() : ''}`
      
      const res = await fetch(url, { 
        cache: 'no-store', 
        signal: controller.signal 
      })

      if (!res.ok) {
        // Handle server errors gracefully
        if (res.status >= 500 && res.status < 600) {
          console.warn(`[Economic Indicators] Server error ${res.status} - indicators data temporarily unavailable`)
          setIndicators([])
          setError(null)
          setIsLoading(false)
          return
        }
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }

      const json = await res.json().catch(() => ({} as any))
      
      // Debug: Log response to help identify data structure issues
      console.log('[Economic Indicators] Raw API response:', JSON.stringify(json, null, 2))
      console.log('[Economic Indicators] Response type:', typeof json, 'Is array?', Array.isArray(json))
      
      // Handle different response formats
      let apiIndicators: ApiEconomicIndicator[] = []
      
      // Check if response has success wrapper (from our API route)
      if (json && typeof json === 'object' && json.success === true && Array.isArray(json.data)) {
        // Our API route returns: { success: true, data: [...] }
        apiIndicators = json.data
        console.log('[Economic Indicators] Found indicators in success.data:', apiIndicators.length)
      } else if (Array.isArray(json)) {
        // Direct array response (fallback)
        apiIndicators = json
        console.log('[Economic Indicators] Found direct array response with', apiIndicators.length, 'indicators')
      } else if (json && typeof json === 'object') {
        // Try other wrapped formats
        if (Array.isArray(json.data)) {
          apiIndicators = json.data
          console.log('[Economic Indicators] Found indicators in json.data:', apiIndicators.length)
        } else if (Array.isArray(json.Data)) {
          apiIndicators = json.Data
          console.log('[Economic Indicators] Found indicators in json.Data:', apiIndicators.length)
        } else if (Array.isArray(json.indicators)) {
          apiIndicators = json.indicators
          console.log('[Economic Indicators] Found indicators in json.indicators:', apiIndicators.length)
        } else {
          console.warn('[Economic Indicators] Could not find indicators array. Response keys:', Object.keys(json))
          console.warn('[Economic Indicators] Response sample:', JSON.stringify(json).substring(0, 500))
        }
      }

      console.log('[Economic Indicators] Final extracted indicators count:', apiIndicators.length)
      if (apiIndicators.length > 0) {
        console.log('[Economic Indicators] Sample indicator:', apiIndicators[0])
      }

      // Transform API indicators to component format (filter out null values)
      console.log('[Economic Indicators] Starting transformation of', apiIndicators.length, 'indicators')
      const transformedIndicators = apiIndicators
        .map((indicator, idx) => {
          try {
            const transformed = transformIndicator(indicator)
            if (!transformed) {
              console.warn(`[Economic Indicators] Indicator ${idx} was filtered out:`, indicator)
            }
            return transformed
          } catch (err) {
            console.error(`[Economic Indicators] Error transforming indicator ${idx}:`, err, indicator)
            return null
          }
        })
        .filter((indicator): indicator is EconomicIndicator => indicator !== null)

      console.log('[Economic Indicators] Transformation complete:', transformedIndicators.length, 'valid indicators out of', apiIndicators.length)

      if (transformedIndicators.length === 0 && apiIndicators.length > 0) {
        console.error('[Economic Indicators] All indicators were filtered out during transformation!')
        console.error('[Economic Indicators] Sample failed indicator:', apiIndicators[0])
      }

      setIndicators(transformedIndicators)
    } catch (e) {
      setError((e as Error).message)
      setIndicators([])
    } finally {
      setIsLoading(false)
    }
  }, [country, category, limit, enabled])

  useEffect(() => {
    fetchIndicators()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchIndicators])

  return { 
    indicators, 
    isLoading, 
    error, 
    refetch: fetchIndicators 
  }
}

