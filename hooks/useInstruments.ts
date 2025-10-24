/**
 * React hooks for instruments and favorites
 */

import { useEffect, useState, useCallback } from 'react'
import { logger } from '@/lib/logger'

export interface Instrument {
  id: string
  symbol: string
  name?: string
  description: string
  category: string
  group?: string
  signal: 'up' | 'down'
  bid: number
  ask: number
  change1d: number
  changePercent1d: number
  isFavorite: boolean
  sortOrder?: number
  addedAt?: string
}

interface UseInstrumentsOptions {
  category?: string
  search?: string
  offset?: number
  limit?: number
  userId?: string | null
}

/**
 * Hook to fetch instruments from database
 * Replaces the old polling-based approach
 */
export function useInstruments(options: UseInstrumentsOptions = {}) {
  const {
    category = 'all',
    search = '',
    offset = 0,
    limit = 100,
    userId = null,
  } = options

  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsSync, setNeedsSync] = useState(false)

  const fetchInstruments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        category,
        offset: offset.toString(),
        limit: limit.toString(),
      })

      if (search) params.append('search', search)
      if (userId) params.append('userId', userId)

      const response = await fetch(`/apis/market-data?${params}`)
      const result = await response.json()

      if (!response.ok) {
        if (result.needsSync) {
          setNeedsSync(true)
        }
        throw new Error(result.message || 'Failed to fetch instruments')
      }

      setInstruments(result.data)
      setTotal(result.total)
      setNeedsSync(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      logger.error('Failed to fetch instruments', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [category, search, offset, limit, userId])

  useEffect(() => {
    fetchInstruments()
  }, [fetchInstruments])

  return {
    instruments,
    total,
    isLoading,
    error,
    needsSync,
    refetch: fetchInstruments,
  }
}

/**
 * Hook to manage user favorites
 */
export function useFavorites(userId: string | null) {
  const [favorites, setFavorites] = useState<Instrument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/apis/user/favorites')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch favorites')
      }

      setFavorites(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      logger.error('Failed to fetch favorites', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const addFavorite = useCallback(
    async (instrumentId: string) => {
      if (!userId) return false

      try {
        const response = await fetch('/apis/user/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instrumentId }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || 'Failed to add favorite')
        }

        // Refetch favorites
        await fetchFavorites()
        return true
      } catch (err) {
        logger.error('Failed to add favorite', err)
        return false
      }
    },
    [userId, fetchFavorites]
  )

  const removeFavorite = useCallback(
    async (instrumentId: string) => {
      if (!userId) return false

      try {
        const response = await fetch('/apis/user/favorites', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instrumentId }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || 'Failed to remove favorite')
        }

        // Refetch favorites
        await fetchFavorites()
        return true
      } catch (err) {
        logger.error('Failed to remove favorite', err)
        return false
      }
    },
    [userId, fetchFavorites]
  )

  const toggleFavorite = useCallback(
    async (instrumentId: string, isFavorite: boolean) => {
      if (isFavorite) {
        return await removeFavorite(instrumentId)
      } else {
        return await addFavorite(instrumentId)
      }
    },
    [addFavorite, removeFavorite]
  )

  const reorderFavorites = useCallback(
    async (favorites: Array<{ instrumentId: string; sortOrder: number }>) => {
      if (!userId) return false

      try {
        const response = await fetch('/apis/user/favorites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorites }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || 'Failed to reorder favorites')
        }

        // Refetch favorites
        await fetchFavorites()
        return true
      } catch (err) {
        logger.error('Failed to reorder favorites', err)
        return false
      }
    },
    [userId, fetchFavorites]
  )

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  return {
    favorites,
    isLoading,
    error,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    reorderFavorites,
    refetch: fetchFavorites,
  }
}

/**
 * Combined hook for instruments with favorites first
 */
export function useInstrumentsWithFavorites(
  userId: string | null,
  options: UseInstrumentsOptions = {}
) {
  const { favorites, isLoading: favoritesLoading, ...favoriteMethods } = useFavorites(userId)
  const {
    instruments,
    total,
    isLoading: instrumentsLoading,
    error,
    needsSync,
    refetch,
  } = useInstruments({ ...options, userId: userId || undefined })

  // Merge favorites and instruments, favorites first
  const mergedInstruments = [
    ...favorites,
    ...instruments.filter(
      inst => !favorites.some(fav => fav.id === inst.id)
    ),
  ]

  return {
    instruments: mergedInstruments,
    favorites,
    total,
    isLoading: favoritesLoading || instrumentsLoading,
    error,
    needsSync,
    refetch,
    ...favoriteMethods,
  }
}

