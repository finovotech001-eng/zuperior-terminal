/**
 * Maps country names to ISO 3166-1 alpha-2 country codes
 * Used for converting API country names to flag codes
 */

const countryNameToCode: Record<string, string> = {
  'United States': 'US',
  'Australia': 'AU',
  'Austria': 'AT',
  'Belgium': 'BE',
  'Brazil': 'BR',
  'Canada': 'CA',
  'China': 'CN',
  'Cyprus': 'CY',
  'Czech Republic': 'CZ',
  'Czechia': 'CZ',
  'Denmark': 'DK',
  'Eurozone': 'EU',
  'European Union': 'EU',
  'Finland': 'FI',
  'France': 'FR',
  'Germany': 'DE',
  'Great Britain': 'GB',
  'United Kingdom': 'GB',
  'Greece': 'GR',
  'Hong Kong': 'HK',
  'Hungary': 'HU',
  'India': 'IN',
  'Ireland': 'IE',
  'Italy': 'IT',
  'Japan': 'JP',
  'Luxembourg': 'LU',
  'Mexico': 'MX',
  'Netherlands': 'NL',
  'New Zealand': 'NZ',
  'Norway': 'NO',
  'Poland': 'PL',
  'Portugal': 'PT',
  'Russia': 'RU',
  'Singapore': 'SG',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  'Spain': 'ES',
  'Sweden': 'SE',
  'Switzerland': 'CH',
  'Turkey': 'TR',
}

/**
 * Get ISO country code from country name
 * @param countryName Full country name (e.g., "United States", "Germany")
 * @returns ISO 3166-1 alpha-2 country code (e.g., "US", "DE") or "US" as default
 */
export function getCountryCode(countryName: string | null | undefined): string {
  if (!countryName) return 'US'
  
  // Direct lookup
  if (countryNameToCode[countryName]) {
    return countryNameToCode[countryName]
  }
  
  // Case-insensitive lookup
  const normalizedName = countryName.trim()
  for (const [name, code] of Object.entries(countryNameToCode)) {
    if (name.toLowerCase() === normalizedName.toLowerCase()) {
      return code
    }
  }
  
  // Try to extract from common patterns
  // "United States of America" -> "US"
  if (normalizedName.toLowerCase().includes('united states')) return 'US'
  if (normalizedName.toLowerCase().includes('great britain') || normalizedName.toLowerCase().includes('uk')) return 'GB'
  if (normalizedName.toLowerCase().includes('eurozone') || normalizedName.toLowerCase().includes('european union')) return 'EU'
  
  // Default to US if not found
  return 'US'
}

/**
 * Get country name from country code (reverse lookup)
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Country name or the code itself if not found
 */
export function getCountryName(countryCode: string | null | undefined): string {
  if (!countryCode) return 'United States'
  
  for (const [name, code] of Object.entries(countryNameToCode)) {
    if (code === countryCode.toUpperCase()) {
      return name
    }
  }
  
  return countryCode.toUpperCase()
}


