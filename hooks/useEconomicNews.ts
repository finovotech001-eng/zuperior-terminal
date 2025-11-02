"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

interface ApiEconomicNews {
  // Support both PascalCase (from API) and camelCase
  id?: string
  Id?: string
  title?: string
  Title?: string
  summary?: string
  Summary?: string
  content?: string
  Content?: string
  category?: string
  Category?: string
  tags?: string[]
  Tags?: string[]
  source?: string
  Source?: string
  author?: string
  Author?: string
  publishedAt?: string | null
  PublishedAt?: string | null
  createdAt?: string | null
  CreatedAt?: string | null
  imageUrl?: string | null
  ImageUrl?: string | null
  url?: string | null
  Url?: string | null
  isBreaking?: boolean
  IsBreaking?: boolean
  language?: string
  Language?: string
}

export interface EconomicNews {
  id: string
  title: string
  summary: string
  content: string
  category: string
  tags: string[]
  source: string
  author: string
  publishedAt: string | null
  createdAt: string | null
  imageUrl: string | null
  url: string | null
  isBreaking: boolean
  language: string
}

interface UseEconomicNewsOptions {
  accountId?: string | null
  country?: string
  category?: string
  limit?: number
  fromDate?: string
  toDate?: string
  enabled?: boolean
}

interface UseEconomicNewsReturn {
  news: EconomicNews[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Transform API news to component format
 */
function transformNews(apiNews: ApiEconomicNews): EconomicNews | null {
  // Handle both PascalCase (from API) and camelCase field names
  const newsId = apiNews.id || apiNews.Id || `news-${Math.random()}`
  const title = apiNews.title || apiNews.Title || 'Untitled News'
  
  if (!newsId || !title || title === 'Untitled News') {
    // Skipping news with missing required fields
    return null
  }

  // Extract fields with fallback to both naming conventions
  const summary = apiNews.summary || apiNews.Summary || ''
  const content = apiNews.content || apiNews.Content || ''
  const category = apiNews.category || apiNews.Category || 'General'
  const tags = apiNews.tags || apiNews.Tags || []
  const source = apiNews.source || apiNews.Source || 'Unknown'
  const author = apiNews.author || apiNews.Author || 'Unknown'
  const publishedAt = apiNews.publishedAt || apiNews.PublishedAt || null
  const createdAt = apiNews.createdAt || apiNews.CreatedAt || null
  const imageUrl = apiNews.imageUrl || apiNews.ImageUrl || null
  const url = apiNews.url || apiNews.Url || null
  const isBreaking = apiNews.isBreaking !== undefined ? apiNews.isBreaking : 
                    (apiNews.IsBreaking !== undefined ? apiNews.IsBreaking : false)
  const language = apiNews.language || apiNews.Language || 'en'
  
  return {
    id: newsId,
    title: title,
    summary: summary,
    content: content,
    category: category,
    tags: tags,
    source: source,
    author: author,
    publishedAt: publishedAt,
    createdAt: createdAt,
    imageUrl: imageUrl,
    url: url,
    isBreaking: isBreaking,
    language: language,
  }
}

export function useEconomicNews({
  accountId,
  country,
  category,
  limit = 20,
  fromDate,
  toDate,
  enabled = true,
}: UseEconomicNewsOptions = {}): UseEconomicNewsReturn {
  const [news, setNews] = useState<EconomicNews[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchNews = useCallback(async () => {
    if (!enabled) return
    
    setIsLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Use accountId from props, fallback to localStorage
      const effectiveAccountId = accountId || (typeof window !== 'undefined' ? localStorage.getItem('accountId') : null)
      if (!effectiveAccountId) {
      }

      // Build query parameters (include accountId)
      const params = new URLSearchParams()
      if (effectiveAccountId) params.append('accountId', effectiveAccountId)
      if (country) params.append('country', country)
      if (category) params.append('category', category)
      if (limit) params.append('limit', limit.toString())
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)

      const url = `/apis/economy/news${params.toString() ? '?' + params.toString() : ''}`
      
      const res = await fetch(url, { 
        cache: 'no-store', 
        signal: controller.signal 
      })

      if (!res.ok) {
        // Handle server errors gracefully
        if (res.status >= 500 && res.status < 600) {
          setNews([])
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
      let apiNewsItems: ApiEconomicNews[] = []
      
      // Check if response has success wrapper (from our API route)
      if (json && typeof json === 'object' && json.success === true && Array.isArray(json.data)) {
        // Our API route returns: { success: true, data: [...] }
        apiNewsItems = json.data
      } else if (Array.isArray(json)) {
        // Direct array response (fallback)
        apiNewsItems = json
      } else if (json && typeof json === 'object') {
        // Try other wrapped formats
        if (Array.isArray(json.data)) {
          apiNewsItems = json.data
        } else if (Array.isArray(json.Data)) {
          apiNewsItems = json.Data
        } else if (Array.isArray(json.news)) {
          apiNewsItems = json.news
        } else {
        }
      }

      // Transform API news to component format (filter out null values)
      const transformedNews = apiNewsItems
        .map((item, idx) => {
          try {
            const transformed = transformNews(item)
            if (!transformed) {
            }
            return transformed
          } catch (err) {
            return null
          }
        })
        .filter((item): item is EconomicNews => item !== null)


      setNews(transformedNews)
    } catch (e) {
      setError((e as Error).message)
      setNews([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId, country, category, limit, fromDate, toDate, enabled])

  useEffect(() => {
    fetchNews()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchNews])

  return { 
    news, 
    isLoading, 
    error, 
    refetch: fetchNews 
  }
}

