// Cache utility for EXIF data and analysis results
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class ExifCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly defaultTTL = 30 * 60 * 1000 // 30 minutes

  // Generate cache key from file
  private generateKey(file: File): string {
    return `${file.name}_${file.size}_${file.lastModified}`
  }

  // Set cache entry
  set<T>(file: File, data: T, ttl: number = this.defaultTTL): void {
    const key = this.generateKey(file)
    const now = Date.now()
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    })

    // Clean expired entries periodically
    this.cleanExpired()
  }

  // Get cache entry
  get<T>(file: File): T | null {
    const key = this.generateKey(file)
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data as T
  }

  // Check if file is cached
  has(file: File): boolean {
    const key = this.generateKey(file)
    const entry = this.cache.get(key)
    
    if (!entry) return false
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  // Clear specific file from cache
  delete(file: File): boolean {
    const key = this.generateKey(file)
    return this.cache.delete(key)
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
  }

  // Clean expired entries
  private cleanExpired(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  getStats(): {
    size: number
    totalEntries: number
    expiredEntries: number
    memoryUsage: string
  } {
    const now = Date.now()
    let expiredCount = 0
    let totalSize = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredCount++
      }
      
      // Rough memory calculation
      totalSize += JSON.stringify(entry.data).length + key.length
    }

    return {
      size: this.cache.size,
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      memoryUsage: `${(totalSize / 1024).toFixed(2)} KB`
    }
  }
}

// Singleton instance
export const exifCache = new ExifCache()

// Cache keys for different types of analysis
export const CACHE_KEYS = {
  EXIF_DATA: 'exif_data',
  HEX_ANALYSIS: 'hex_analysis',
  ELA_ANALYSIS: 'ela_analysis',
  FORENSIC_ANALYSIS: 'forensic_analysis',
  BATCH_SUMMARY: 'batch_summary'
} as const

// Cache with specific analysis type
export function setCachedAnalysis<T>(
  file: File, 
  analysisType: keyof typeof CACHE_KEYS, 
  data: T, 
  ttl?: number
): void {
  const key = `${CACHE_KEYS[analysisType]}_${file.name}_${file.size}_${file.lastModified}`
  exifCache.set({ ...file, name: key } as File, data, ttl)
}

// Get cached analysis
export function getCachedAnalysis<T>(
  file: File, 
  analysisType: keyof typeof CACHE_KEYS
): T | null {
  const key = `${CACHE_KEYS[analysisType]}_${file.name}_${file.size}_${file.lastModified}`
  return exifCache.get<T>({ ...file, name: key } as File)
}

// Check if analysis is cached
export function hasCachedAnalysis(
  file: File, 
  analysisType: keyof typeof CACHE_KEYS
): boolean {
  const key = `${CACHE_KEYS[analysisType]}_${file.name}_${file.size}_${file.lastModified}`
  return exifCache.has({ ...file, name: key } as File)
}

// Progressive cache warming for common operations
export async function warmCache(files: File[]): Promise<void> {
  const promises = files.map(async (file) => {
    // Only warm cache for files not already cached
    if (!exifCache.has(file)) {
      try {
        // Import EXIF library dynamically
        const EXIF = await import('exifr')
        const exifData = await EXIF.parse(file, {
          gps: true,
          tiff: true,
          exif: true,
          jfif: true,
          ihdr: true
        })
        
        exifCache.set(file, exifData)
      } catch (error) {
        console.warn(`Failed to warm cache for ${file.name}:`, error)
      }
    }
  })
  
  await Promise.allSettled(promises)
}

// Cache cleanup utility
export function cleanupCache(): void {
  const stats = exifCache.getStats()
  
  // If cache is getting large, clear expired entries
  if (stats.size > 100) {
    exifCache['cleanExpired']()
  }
  
  // If still too large, clear oldest entries
  if (stats.size > 200) {
    exifCache.clear()
  }
}

// Auto cleanup on page visibility change
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cleanupCache()
    }
  })
}