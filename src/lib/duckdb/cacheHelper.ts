import { browser } from '$app/environment';
import { dbCore } from './dbCore';
import { notifications } from '$lib/utils/notificationUtils';

// Cache configuration
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes
const CACHE_PREFIX = 'duckdb_query_';

// Track which dataset is in use for cache versioning
let datasetVersion: 'sample' | 'full' = 'sample'; // Start with 'sample', will be changed to 'full' when full dataset loads

/**
 * Set the dataset version to update cache keys
 * @param version The new dataset version ('sample' or 'full')
 */
function setDatasetVersion(version: 'sample' | 'full'): void {
  datasetVersion = version;
}

/**
 * Get the current dataset version
 * @returns The current dataset version ('sample' or 'full')
 */
function getDatasetVersion(): 'sample' | 'full' {
  return datasetVersion;
}

/**
 * Execute a query with caching
 * @param queryFn Function that performs the actual query
 * @param cacheKey Optional key for caching results
 * @returns Query results
 */
async function executeQueryWithCache<T>(
  queryFn: () => Promise<T>,
  cacheKey?: string
): Promise<T> {
  const db = dbCore.getDatabase();
  if (!db) {
    throw new Error('DuckDB is not initialized');
  }
  
  // Check cache if key provided and in browser
  if (cacheKey && browser) {
    // Include dataset version in cache key to ensure fresh queries when dataset changes
    const versionedCacheKey = `${datasetVersion}_${cacheKey}`;
    
    try {
      const cachedData = localStorage.getItem(`${CACHE_PREFIX}${versionedCacheKey}`);
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
        
        // Cache valid for 60 minutes
        if (ageInMinutes < 60) {       
          return data as T;
        }
      }
    } catch (error) {
      console.warn('Error reading from cache:', error);
    }
  }
  
  try {
    // Execute the query function
    const result = await queryFn();
    
    // Store in cache if key provided
    if (cacheKey && browser) {
      try {
        // Include dataset version in cache key
        const versionedCacheKey = `${datasetVersion}_${cacheKey}`;
        localStorage.setItem(`${CACHE_PREFIX}${versionedCacheKey}`, JSON.stringify({
          timestamp: Date.now(),
          data: result
        }));
      } catch (error) {
        console.warn('Error writing to cache:', error);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

/**
 * Generate a cache key from parameters
 * @param params Parameters to include in the key
 * @returns Unique cache key
 */
function generateCacheKey(params: any): string {
  return btoa(JSON.stringify(params)).replace(/[=+/]/g, '');
}

/**
 * Clear all cached queries
 */
function clearCache(): void {
  if (!browser) return;
  
  try {
    // Find all keys starting with the cache prefix
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all cache entries
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} cached queries`);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Export caching utilities
export const cacheHelper = {
  executeQueryWithCache,
  generateCacheKey,
  clearCache,
  setDatasetVersion,
  getDatasetVersion
}; 