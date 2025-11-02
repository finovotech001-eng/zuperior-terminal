"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

interface ApiInterestRate {
  // Support both PascalCase (from API) and camelCase
  id?: string
  Id?: string
  bankName?: string
  BankName?: string
  country?: string
  Country?: string
  currency?: string
  Currency?: string
  rateType?: string
  RateType?: string
  currentRate?: number | null
  CurrentRate?: number | null
  lastChangeDate?: string | null
  LastChangeDate?: string | null
  previousRate?: number | null
  PreviousRate?: number | null
  rateDirection?: string
  RateDirection?: string
  nextMeetingDate?: string | null
  NextMeetingDate?: string | null
  rateStatement?: string | null
  RateStatement?: string | null
  forecast?: string | null
  Forecast?: string | null
  source?: string
  Source?: string
  updatedAt?: string | null
  UpdatedAt?: string | null
}

export interface InterestRate {
  id: string
  bankName: string
  country: string
  currency: string
  rateType: string
  currentRate: number | null
  lastChangeDate: string | null
  previousRate: number | null
  rateDirection: string
  nextMeetingDate: string | null
  rateStatement: string | null
  forecast: string | null
  source: string
  updatedAt: string | null
}

interface UseInterestRatesOptions {
  country?: string
  bank?: string
  limit?: number
  enabled?: boolean
}

interface UseInterestRatesReturn {
  interestRates: InterestRate[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Transform API interest rate to component format
 */
function transformInterestRate(apiRate: ApiInterestRate): InterestRate | null {
  // Handle both PascalCase (from API) and camelCase field names
  const rateId = apiRate.id || apiRate.Id || `rate-${Math.random()}`
  const bankName = apiRate.bankName || apiRate.BankName || 'Unknown Bank'
  
  if (!rateId || !bankName || bankName === 'Unknown Bank') {
    console.warn('[Interest Rates] Skipping rate with missing required fields:', {
      id: apiRate.id || apiRate.Id,
      bankName: apiRate.bankName || apiRate.BankName,
      fullRate: apiRate
    })
    return null
  }

  // Extract fields with fallback to both naming conventions
  const country = apiRate.country || apiRate.Country || 'Unknown'
  const currency = apiRate.currency || apiRate.Currency || 'USD'
  const rateType = apiRate.rateType || apiRate.RateType || 'Base Rate'
  const currentRate = apiRate.currentRate !== undefined ? apiRate.currentRate : 
                     (apiRate.CurrentRate !== undefined ? apiRate.CurrentRate : null)
  const lastChangeDate = apiRate.lastChangeDate || apiRate.LastChangeDate || null
  const previousRate = apiRate.previousRate !== undefined ? apiRate.previousRate : 
                      (apiRate.PreviousRate !== undefined ? apiRate.PreviousRate : null)
  const rateDirection = apiRate.rateDirection || apiRate.RateDirection || 'Neutral'
  const nextMeetingDate = apiRate.nextMeetingDate || apiRate.NextMeetingDate || null
  const rateStatement = apiRate.rateStatement || apiRate.RateStatement || null
  const forecast = apiRate.forecast || apiRate.Forecast || null
  const source = apiRate.source || apiRate.Source || 'Unknown'
  const updatedAt = apiRate.updatedAt || apiRate.UpdatedAt || null
  
  return {
    id: rateId,
    bankName: bankName,
    country: country,
    currency: currency,
    rateType: rateType,
    currentRate: currentRate,
    lastChangeDate: lastChangeDate,
    previousRate: previousRate,
    rateDirection: rateDirection,
    nextMeetingDate: nextMeetingDate,
    rateStatement: rateStatement,
    forecast: forecast,
    source: source,
    updatedAt: updatedAt,
  }
}

export function useInterestRates({
  country,
  bank,
  limit = 20,
  enabled = true,
}: UseInterestRatesOptions = {}): UseInterestRatesReturn {
  const [interestRates, setInterestRates] = useState<InterestRate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchInterestRates = useCallback(async () => {
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
        console.warn('[Interest Rates] No AccountId found, rates may not work')
      }

      // Build query parameters (include accountId)
      const params = new URLSearchParams()
      if (accountId) params.append('accountId', accountId)
      if (country) params.append('country', country)
      if (bank) params.append('bank', bank)
      if (limit) params.append('limit', limit.toString())

      const url = `/apis/economy/interest-rates${params.toString() ? '?' + params.toString() : ''}`
      
      const res = await fetch(url, { 
        cache: 'no-store', 
        signal: controller.signal 
      })

      if (!res.ok) {
        // Handle server errors gracefully
        if (res.status >= 500 && res.status < 600) {
          console.warn(`[Interest Rates] Server error ${res.status} - rates data temporarily unavailable`)
          setInterestRates([])
          setError(null)
          setIsLoading(false)
          return
        }
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }

      const json = await res.json().catch(() => ({} as any))
      
      // Debug: Log response to help identify data structure issues
      console.log('[Interest Rates] Raw API response:', JSON.stringify(json, null, 2))
      console.log('[Interest Rates] Response type:', typeof json, 'Is array?', Array.isArray(json))
      
      // Handle different response formats
      let apiRates: ApiInterestRate[] = []
      
      // Check if response has success wrapper (from our API route)
      if (json && typeof json === 'object' && json.success === true && Array.isArray(json.data)) {
        // Our API route returns: { success: true, data: [...] }
        apiRates = json.data
        console.log('[Interest Rates] Found rates in success.data:', apiRates.length)
      } else if (Array.isArray(json)) {
        // Direct array response (fallback)
        apiRates = json
        console.log('[Interest Rates] Found direct array response with', apiRates.length, 'rates')
      } else if (json && typeof json === 'object') {
        // Try other wrapped formats
        if (Array.isArray(json.data)) {
          apiRates = json.data
          console.log('[Interest Rates] Found rates in json.data:', apiRates.length)
        } else if (Array.isArray(json.Data)) {
          apiRates = json.Data
          console.log('[Interest Rates] Found rates in json.Data:', apiRates.length)
        } else if (Array.isArray(json.interestRates)) {
          apiRates = json.interestRates
          console.log('[Interest Rates] Found rates in json.interestRates:', apiRates.length)
        } else {
          console.warn('[Interest Rates] Could not find rates array. Response keys:', Object.keys(json))
          console.warn('[Interest Rates] Response sample:', JSON.stringify(json).substring(0, 500))
        }
      }

      console.log('[Interest Rates] Final extracted rates count:', apiRates.length)
      if (apiRates.length > 0) {
        console.log('[Interest Rates] Sample rate:', apiRates[0])
      }

      // Transform API rates to component format (filter out null values)
      console.log('[Interest Rates] Starting transformation of', apiRates.length, 'rates')
      const transformedRates = apiRates
        .map((rate, idx) => {
          try {
            const transformed = transformInterestRate(rate)
            if (!transformed) {
              console.warn(`[Interest Rates] Rate ${idx} was filtered out:`, rate)
            }
            return transformed
          } catch (err) {
            console.error(`[Interest Rates] Error transforming rate ${idx}:`, err, rate)
            return null
          }
        })
        .filter((rate): rate is InterestRate => rate !== null)

      console.log('[Interest Rates] Transformation complete:', transformedRates.length, 'valid rates out of', apiRates.length)

      if (transformedRates.length === 0 && apiRates.length > 0) {
        console.error('[Interest Rates] All rates were filtered out during transformation!')
        console.error('[Interest Rates] Sample failed rate:', apiRates[0])
      }

      setInterestRates(transformedRates)
    } catch (e) {
      setError((e as Error).message)
      setInterestRates([])
    } finally {
      setIsLoading(false)
    }
  }, [country, bank, limit, enabled])

  useEffect(() => {
    fetchInterestRates()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchInterestRates])

  return { 
    interestRates, 
    isLoading, 
    error, 
    refetch: fetchInterestRates 
  }
}

