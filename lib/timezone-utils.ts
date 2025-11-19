"use client"

import { useAtomValue } from "jotai"
import { settingsAtom } from "@/lib/store"

/**
 * Get timezone offset in hours for the selected timezone
 */
function getTimezoneOffset(timezone: string): number {
  switch (timezone.toLowerCase()) {
    case 'utc':
      return 0
    case 'est':
      return -5 // Eastern Standard Time (UTC-5)
    case 'pst':
      return -8 // Pacific Standard Time (UTC-8)
    case 'gmt':
      return 0 // GMT is same as UTC
    default:
      return 0
  }
}

/**
 * Format a date/time string according to the selected timezone
 */
export function formatTimeForTimezone(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--:-- --'
  
  const offset = getTimezoneOffset(timezone)
  const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000)
  const targetTime = new Date(utcTime + (offset * 3600000))
  
  const hours = targetTime.getHours()
  const minutes = targetTime.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  const displayMinutes = minutes.toString().padStart(2, '0')
  
  return `${displayHours}:${displayMinutes} ${ampm}`
}

/**
 * Format a date string according to the selected timezone
 */
export function formatDateForTimezone(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--'
  
  const offset = getTimezoneOffset(timezone)
  const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000)
  const targetTime = new Date(utcTime + (offset * 3600000))
  
  return targetTime.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Format date and time according to the selected timezone
 */
export function formatDateTimeForTimezone(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--:-- --'
  
  const offset = getTimezoneOffset(timezone)
  const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000)
  const targetTime = new Date(utcTime + (offset * 3600000))
  
  const dateStr = targetTime.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
  const timeStr = formatTimeForTimezone(targetTime, timezone)
  
  return `${dateStr} ${timeStr}`
}

/**
 * Hook to get timezone-aware formatting functions
 */
export function useTimezoneFormatting() {
  const settings = useAtomValue(settingsAtom)
  const timezone = settings.timezone || 'utc'
  
  return {
    formatTime: (date: Date | string) => formatTimeForTimezone(date, timezone),
    formatDate: (date: Date | string) => formatDateForTimezone(date, timezone),
    formatDateTime: (date: Date | string) => formatDateTimeForTimezone(date, timezone),
    timezone
  }
}





