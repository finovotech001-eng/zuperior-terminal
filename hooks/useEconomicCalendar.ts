"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'
import { EventsByDate } from '@/components/trading/economic-calendar'
import { EconomicEvent } from '@/components/trading/economic-calendar-event'
import { getCountryCode } from '@/lib/country-mapping'

interface ApiEconomicEvent {
  // Support both PascalCase (from API) and camelCase
  id?: string
  Id?: string
  title?: string
  Title?: string
  country?: string
  Country?: string
  indicator?: string
  Indicator?: string
  category?: string
  Category?: string
  eventTime?: string
  EventTime?: string
  publishTime?: string
  PublishTime?: string
  currency?: string
  Currency?: string
  importance?: string
  Importance?: string
  actual?: string | null
  Actual?: string | null
  forecast?: string | null
  Forecast?: string | null
  previous?: string | null
  Previous?: string | null
  unit?: string
  Unit?: string
  description?: string
  Description?: string
  isTentative?: boolean
  IsTentative?: boolean
  isRevised?: boolean
  IsRevised?: boolean
}

interface UseEconomicCalendarOptions {
  accountId?: string | null
  country?: string
  category?: string
  importance?: string
  fromDate?: string
  toDate?: string
  limit?: number
  enabled?: boolean
}

interface UseEconomicCalendarReturn {
  events: EventsByDate[]
  isLoading: boolean
  error: string | null
  isConnected: boolean
  isConnecting: boolean
  refetch: () => void
}

// SignalR Hub URL for economy
const ECONOMY_HUB_URL = (process.env.NEXT_PUBLIC_API_BASE_URL && `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/hubs/economy`) || 'http://18.175.242.21:5003/hubs/economy'

/**
 * Format ISO date string to "HH:MM AM/PM" format
 */
function formatTime(isoString: string | null | undefined): string {
  if (!isoString) {
    return '--:-- --'
  }
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return '--:-- --'
    }
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${ampm}`
  } catch {
    return '--:-- --'
  }
}

/**
 * Format ISO date string to "Month Day" format (e.g., "October 14")
 */
function formatDisplayDate(isoString: string | null | undefined): string {
  if (!isoString) {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  }
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    }
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  } catch {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  }
}

/**
 * Get date string in YYYY-MM-DD format from ISO string
 */
function getDateString(isoString: string | null | undefined): string {
  if (!isoString) {
    // Return today's date as fallback
    return new Date().toISOString().split('T')[0]
  }
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      // Invalid date, return today's date
      return new Date().toISOString().split('T')[0]
    }
    return date.toISOString().split('T')[0]
  } catch {
    // If it's a string, try to extract date part
    if (typeof isoString === 'string' && isoString.includes('T')) {
      return isoString.split('T')[0]
    }
    // Fallback to today's date
    return new Date().toISOString().split('T')[0]
  }
}

/**
 * Format value with unit
 */
function formatValue(value: string | null | undefined, unit?: string): string | undefined {
  if (!value || value === 'null' || value === 'undefined') return undefined
  if (unit && !value.includes(unit)) {
    return `${value}${unit}`
  }
  return value
}

/**
 * Convert importance string to impact level
 */
function importanceToImpact(importance: string | null | undefined): 'high' | 'medium' | 'low' {
  if (!importance) return 'low'
  const lower = importance.toLowerCase()
  if (lower === 'high') return 'high'
  if (lower === 'medium') return 'medium'
  return 'low'
}

/**
 * Transform API event to component event format with date info
 */
interface TransformedEvent extends EconomicEvent {
  _date: string
  _displayDate: string
}

function transformEvent(apiEvent: ApiEconomicEvent): TransformedEvent | null {
  // Handle both PascalCase (from API) and camelCase field names
  const eventId = apiEvent.id || apiEvent.Id || apiEvent.title || apiEvent.Title || `event-${Math.random()}`
  const eventTitle = apiEvent.title || apiEvent.Title || apiEvent.indicator || apiEvent.Indicator || 'Untitled Event'
  
  if (!eventId || (!eventTitle || eventTitle === 'Untitled Event') && !apiEvent.indicator && !apiEvent.Indicator) {
    // Skipping event with missing required fields
    return null
  }

  // Use eventTime, publishTime, or current date as fallback (handle both cases)
  const eventTime = apiEvent.eventTime || apiEvent.EventTime || 
                   apiEvent.publishTime || apiEvent.PublishTime || 
                   new Date().toISOString()
  const eventDate = getDateString(eventTime)
  const displayDate = formatDisplayDate(eventTime)
  
  // Extract fields with fallback to both naming conventions
  const country = apiEvent.country || apiEvent.Country || 'Unknown'
  const importance = apiEvent.importance || apiEvent.Importance || 'Low'
  const actual = apiEvent.actual !== undefined ? apiEvent.actual : 
                (apiEvent.Actual !== undefined ? apiEvent.Actual : null)
  const forecast = apiEvent.forecast !== undefined ? apiEvent.forecast : 
                   (apiEvent.Forecast !== undefined ? apiEvent.Forecast : null)
  const previous = apiEvent.previous !== undefined ? apiEvent.previous : 
                   (apiEvent.Previous !== undefined ? apiEvent.Previous : null)
  const unit = apiEvent.unit || apiEvent.Unit
  const description = apiEvent.description || apiEvent.Description
  
  return {
    id: eventId,
    time: formatTime(eventTime),
    title: eventTitle,
    country: country,
    countryCode: getCountryCode(country),
    impact: importanceToImpact(importance),
    actual: formatValue(actual, unit),
    forecast: formatValue(forecast, unit),
    previous: formatValue(previous, unit),
    description: description,
    _date: eventDate,
    _displayDate: displayDate,
  }
}

export function useEconomicCalendar({
  accountId,
  country,
  category,
  importance,
  fromDate,
  toDate,
  limit = 50,
  enabled = true,
}: UseEconomicCalendarOptions = {}): UseEconomicCalendarReturn {
  const [events, setEvents] = useState<EventsByDate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const mountedRef = useRef(true)

  const fetchCalendar = useCallback(async () => {
    if (!enabled) return
    
    setIsLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Use accountId from props, fallback to localStorage
      const effectiveAccountId = accountId || (typeof window !== 'undefined' ? localStorage.getItem('accountId') : null)
      // If we still don't have an account id, return gracefully with empty data
      if (!effectiveAccountId) {
        setEvents([])
        setIsLoading(false)
        return
      }

      // Build query parameters (include accountId)
      const params = new URLSearchParams()
      if (effectiveAccountId) params.append('accountId', effectiveAccountId)
      if (country) params.append('country', country)
      if (category) params.append('category', category)
      if (importance) params.append('importance', importance)
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      if (limit) params.append('limit', limit.toString())

      const url = `/apis/economy/calendar${params.toString() ? '?' + params.toString() : ''}`
      
      const res = await fetch(url, { 
        cache: 'no-store', 
        signal: controller.signal 
      })

      if (!res.ok) {
        // Handle server errors gracefully
        if (res.status >= 500 && res.status < 600) {
          setEvents([])
          setError(null)
          setIsLoading(false)
          return
        }
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }

      const json = await res.json().catch(() => ({} as any))
      
      // Debug: Log response to help identify data structure issues
      
      // Handle different response formats
      let apiEvents: ApiEconomicEvent[] = []
      
      // Check if response has success wrapper (from our API route)
      if (json && typeof json === 'object' && json.success === true && Array.isArray(json.data)) {
        // Our API route returns: { success: true, data: [...] }
        apiEvents = json.data
      } else if (Array.isArray(json)) {
        // Direct array response (fallback)
        apiEvents = json
      } else if (json && typeof json === 'object') {
        // Try other wrapped formats
        if (Array.isArray(json.data)) {
          apiEvents = json.data
        } else if (Array.isArray(json.Data)) {
          apiEvents = json.Data
        } else if (Array.isArray(json.events)) {
          apiEvents = json.events
        } else if (Array.isArray(json.items)) {
          apiEvents = json.items
        }
      }

      // Transform API events to component format (filter out null values)
      const transformedEvents = apiEvents
        .map((event, idx) => {
          try {
            const transformed = transformEvent(event)
            if (!transformed) {
            }
            return transformed
          } catch (err) {
            return null
          }
        })
        .filter((event): event is TransformedEvent => event !== null)

      if (transformedEvents.length === 0 && apiEvents.length > 0) {
        setEvents([])
        setIsLoading(false)
        return
      }

      // Group events by date
      const grouped = new Map<string, { date: string; displayDate: string; events: EconomicEvent[] }>()
      
      transformedEvents.forEach((event) => {
        const dateKey = event._date
        const displayDate = event._displayDate
        
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            date: dateKey,
            displayDate: displayDate,
            events: [],
          })
        }
        
        // Remove internal date fields before adding to events
        const { _date, _displayDate, ...eventData } = event
        grouped.get(dateKey)!.events.push(eventData)
      })

      // Convert map to array and sort by date
      const eventsByDate: EventsByDate[] = Array.from(grouped.values())
        .sort((a, b) => a.date.localeCompare(b.date))


      setEvents(eventsByDate)
    } catch (e) {
      setError((e as Error).message)
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId, country, category, importance, fromDate, toDate, limit, enabled])

  // Connect to SignalR for real-time updates
  const connectSignalR = useCallback(async () => {
    if (!enabled || connectionRef.current) return

    try {
      setIsConnecting(true)
      setError(null)

      // Get manager token for authentication (economic calendar uses manager auth, not account-specific)
      const tokenResponse = await fetch('/apis/economy/calendar', { method: 'HEAD' }).catch(() => null)
      
      // Build hub URL
      const hubUrl = ECONOMY_HUB_URL

      // Create SignalR connection with proxy for negotiate requests
      class ProxyHttpClient extends signalR.HttpClient {
        get(url: string, options?: signalR.HttpRequest): Promise<signalR.HttpResponse> {
          if (url.includes('/negotiate')) {
            const urlObj = new URL(url)
            const proxyUrl = `/apis/signalr/negotiate?hub=economy&${urlObj.searchParams.toString()}`
            
            return fetch(proxyUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
              },
            }).then(async (response) => {
              const data = await response.json()
              return new signalR.HttpResponse(
                response.status,
                response.statusText,
                JSON.stringify(data)
              )
            })
          }
          
          return fetch(url, {
            method: 'GET',
            headers: options?.headers,
          }).then(async (response) => {
            const content = await response.text()
            return new signalR.HttpResponse(
              response.status,
              response.statusText,
              content
            )
          })
        }
      }

      connectionRef.current = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => '', // Economy hub may not require token, or use manager token
          transport: signalR.HttpTransportType.LongPolling,
          withCredentials: false,
          httpClient: new ProxyHttpClient(),
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            return 5000
          }
        })
        .configureLogging(signalR.LogLevel.Warning)
        .build()

      // Listen for economic event updates
      connectionRef.current.on('EconomicEventUpdate', (eventData: ApiEconomicEvent) => {
        if (!mountedRef.current) return
        
        
        // Transform the new event (may return null if invalid)
        const transformed = transformEvent(eventData)
        if (!transformed) {
          return
        }
        
        const eventDate = transformed._date
        const displayDate = transformed._displayDate
        
        // Merge with existing events
        setEvents(prev => {
          const updated = [...prev]
          const dateGroup = updated.find(g => g.date === eventDate)
          
          if (dateGroup) {
            // Update existing date group
            const existingIndex = dateGroup.events.findIndex(e => e.id === transformed.id)
            const cleanEvent: EconomicEvent = {
              id: transformed.id,
              time: transformed.time,
              title: transformed.title,
              country: transformed.country,
              countryCode: transformed.countryCode,
              impact: transformed.impact,
              actual: transformed.actual,
              forecast: transformed.forecast,
              previous: transformed.previous,
              description: transformed.description,
            }
            
            if (existingIndex >= 0) {
              // Update existing event
              dateGroup.events[existingIndex] = cleanEvent
            } else {
              // Add new event to existing date
              dateGroup.events.push(cleanEvent)
              // Sort events by time
              dateGroup.events.sort((a, b) => a.time.localeCompare(b.time))
            }
          } else {
            // Create new date group
            const cleanEvent: EconomicEvent = {
              id: transformed.id,
              time: transformed.time,
              title: transformed.title,
              country: transformed.country,
              countryCode: transformed.countryCode,
              impact: transformed.impact,
              actual: transformed.actual,
              forecast: transformed.forecast,
              previous: transformed.previous,
              description: transformed.description,
            }
            updated.push({
              date: eventDate,
              displayDate: displayDate,
              events: [cleanEvent],
            })
            // Sort by date
            updated.sort((a, b) => a.date.localeCompare(b.date))
          }
          
          return updated
        })
      })

      connectionRef.current.onreconnecting(() => {
        setIsConnected(false)
      })

      connectionRef.current.onreconnected(() => {
        setIsConnected(true)
      })

      connectionRef.current.onclose(() => {
        setIsConnected(false)
      })

      await connectionRef.current.start()
      setIsConnected(true)
      setIsConnecting(false)
    } catch (err) {
      // Don't set error - allow app to continue without WebSocket
      setIsConnected(false)
      setIsConnecting(false)
      if (connectionRef.current) {
        connectionRef.current = null
      }
    }
  }, [enabled])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchCalendar()
    
    // Connect to SignalR for real-time updates
    if (enabled) {
      connectSignalR()
    }

    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (connectionRef.current) {
        connectionRef.current.stop().catch(() => {})
        connectionRef.current = null
      }
    }
  }, [fetchCalendar, connectSignalR, enabled])

  return { 
    events, 
    isLoading, 
    error, 
    isConnected,
    isConnecting,
    refetch: fetchCalendar 
  }
}
