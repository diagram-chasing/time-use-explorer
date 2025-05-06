import { allColumns } from './constants';
import { executeQuery, executeSummaryQuery, calculateTimeSpentByDemographic, getDatasetVersion } from '$lib/duckdb/service';
import { browser } from '$app/environment';
import { notifications } from './notificationUtils';

// Types
export type Filter = {
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
};

export type Aggregation = {
  column: string;
  function: string;
};

// Cache constants
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes
const QUERY_CACHE_PREFIX = 'timeuse_query_cache_';
const QUERY_CACHE_VERSION = 'v2'; // Updated cache version

/**
 * Clear all cached query results
 */
export function clearAllQueryCache(): void {
  if (!browser) return;

  try {
    // Find all keys starting with the cache prefix
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(QUERY_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    // Remove all cache entries
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[queryUtils] Cleared ${keysToRemove.length} cached queries`);
  } catch (error) {
    console.error('[queryUtils] Error clearing cache:', error);
  }
}

/**
 * Cache query results in local storage
 * @param key Unique key for the query
 * @param data Query result data to cache
 */
export function cacheQueryResult(key: string, data: any): void {
  if (!browser) return;

  try {
    // Use DuckDB's dataset version for cache key versioning
    const datasetVersion = getDatasetVersion();
    const versionedCacheKey = `${QUERY_CACHE_PREFIX}${QUERY_CACHE_VERSION}_${datasetVersion}_${key}`;
    const cacheEntry = {
      timestamp: Date.now(),
      data
    };

    // Use a chunked approach for large results to avoid localStorage limits
    const jsonData = JSON.stringify(cacheEntry);

    // If data is too large, chunk it
    if (jsonData.length > 1000000) { // ~1MB
      const chunks = Math.ceil(jsonData.length / 1000000);
      console.log(`Splitting cache data into ${chunks} chunks...`);

      // Store metadata
      localStorage.setItem(`${versionedCacheKey}_meta`, JSON.stringify({
        chunks,
        totalLength: jsonData.length,
        timestamp: Date.now()
      }));

      // Store chunks
      for (let i = 0; i < chunks; i++) {
        const start = i * 1000000;
        const end = Math.min(start + 1000000, jsonData.length);
        localStorage.setItem(`${versionedCacheKey}_${i}`, jsonData.substring(start, end));
      }
    } else {
      // Store normally for small data
      localStorage.setItem(versionedCacheKey, jsonData);
    }

    console.log(`Cached query result for key: ${key} (${datasetVersion} dataset)`);
  } catch (error) {
    console.warn('Failed to cache query result:', error);
  }
}

/**
 * Retrieve cached query results if available and not expired
 * @param key Unique key for the query
 * @returns Cached data or null if not found or expired
 */
export function getCachedQueryResult(key: string): any {
  if (!browser) return null;

  try {
    // Use DuckDB's dataset version for cache key versioning
    const datasetVersion = getDatasetVersion();
    const versionedCacheKey = `${QUERY_CACHE_PREFIX}${QUERY_CACHE_VERSION}_${datasetVersion}_${key}`;

    // Check if we have metadata for chunked data
    const metaData = localStorage.getItem(`${versionedCacheKey}_meta`);

    if (metaData) {
      // We have chunked data
      const meta = JSON.parse(metaData);
      const age = Date.now() - meta.timestamp;

      // Check if cache is still valid
      if (age <= CACHE_EXPIRY_MS) {
        // Reconstruct the chunks
        let jsonData = '';
        for (let i = 0; i < meta.chunks; i++) {
          const chunk = localStorage.getItem(`${versionedCacheKey}_${i}`);
          if (!chunk) {
            console.warn(`Missing chunk ${i} for key ${key}, cache is invalid`);
            return null;
          }
          jsonData += chunk;
        }

        // Parse and return the data
        const cacheEntry = JSON.parse(jsonData);


        console.log(`Using chunked cached query result for key: ${key} (${datasetVersion} dataset)`);
        return cacheEntry.data;
      } else {
        // Clear expired chunks
        for (let i = 0; i < meta.chunks; i++) {
          localStorage.removeItem(`${versionedCacheKey}_${i}`);
        }
        localStorage.removeItem(`${versionedCacheKey}_meta`);
        return null;
      }
    } else {
      // Check for normal cache entry
      const cachedValue = localStorage.getItem(versionedCacheKey);
      if (!cachedValue) return null;

      const cacheEntry = JSON.parse(cachedValue);
      const age = Date.now() - cacheEntry.timestamp;

      // Check if cache is still valid
      if (age <= CACHE_EXPIRY_MS) {
        console.log(`Using cached query result for key: ${key} (${datasetVersion} dataset)`);


        return cacheEntry.data;
      } else {
        // Clear expired cache
        localStorage.removeItem(versionedCacheKey);
        return null;
      }
    }
  } catch (error) {
    console.warn('Failed to retrieve cached query result:', error);
    return null;
  }
}

/**
 * Generate a cache key for a query based on its parameters
 * @param params Query parameters to be hashed into a key
 * @returns A string key representing the query
 */
export function generateQueryCacheKey(params: any): string {
  // Simple string-based hash function
  return btoa(JSON.stringify(params)).replace(/[=+/]/g, '');
}

/**
 * Builds a WHERE clause from filters for SQL queries
 * @param filters Array of filter objects to process
 * @returns SQL WHERE clause string (without 'WHERE' keyword)
 */
export function buildWhereClause(filters: Filter[]): string {
  let whereConditions: string[] = [];

  filters.forEach(filter => {
    if (filter.enabled && filter.value) {
      // Handle special time virtual column
      if (filter.column === 'time') {
        // For the BETWEEN operator, ensure there's a comma separating the values
        if (filter.operator === 'BETWEEN' || filter.operator === 'NOT BETWEEN') {
          if (!filter.value.includes(',')) {
            console.error('Time range filter requires comma-separated values. Format: "start_time,end_time"');
            // We'll still try to process it, the handleTimeRangeFilter will handle this gracefully
          }
        }

        // Process time range filter differently
        handleTimeRangeFilter(filter, whereConditions);
        return; // Skip regular processing for this filter
      }

      // Get column type from our columns data
      const columnInfo = allColumns.find(c => c.id === filter.column);
      const columnType = columnInfo?.type || '';

      // Format value based on column type
      let formattedValue;

      if (columnType === 'string') {
        // For string types, wrap in quotes
        formattedValue = `'${filter.value.replace(/'/g, "''")}'`;
      } else if (columnType === 'number') {
        // For numeric types, use the value directly without quotes
        // and cast to INTEGER to avoid BigInt mixing issues
        formattedValue = `CAST(${filter.value} AS INTEGER)`;
      } else {
        // Default case
        formattedValue = typeof filter.value === 'string' ? `'${filter.value.replace(/'/g, "''")}'` : filter.value;
      }

      // Build condition based on operator
      switch (filter.operator) {
        case '=':
          if (columnType === 'string') {
            // Use case-insensitive comparison for strings
            whereConditions.push(`UPPER(${filter.column}) = UPPER(${formattedValue})`);
          } else {
            whereConditions.push(`${filter.column} = ${formattedValue}`);
          }
          break;
        case '!=':
          if (columnType === 'string') {
            // Use case-insensitive comparison for strings
            whereConditions.push(`UPPER(${filter.column}) <> UPPER(${formattedValue})`);
          } else {
            whereConditions.push(`${filter.column} <> ${formattedValue}`);
          }
          break;
        case '>':
          whereConditions.push(`${filter.column} > ${formattedValue}`);
          break;
        case '<':
          whereConditions.push(`${filter.column} < ${formattedValue}`);
          break;
        case '>=':
          whereConditions.push(`${filter.column} >= ${formattedValue}`);
          break;
        case '<=':
          whereConditions.push(`${filter.column} <= ${formattedValue}`);
          break;
        case 'LIKE':
          // Use case-insensitive LIKE for string columns
          if (columnType === 'string') {
            whereConditions.push(`UPPER(${filter.column}) LIKE UPPER('%${filter.value.replace(/'/g, "''")}%')`);
          } else {
            whereConditions.push(`${filter.column} LIKE '%${filter.value.replace(/'/g, "''")}%'`);
          }
          break;
        case 'NOT LIKE':
          // Use case-insensitive NOT LIKE for string columns
          if (columnType === 'string') {
            whereConditions.push(`UPPER(${filter.column}) NOT LIKE UPPER('%${filter.value.replace(/'/g, "''")}%')`);
          } else {
            whereConditions.push(`${filter.column} NOT LIKE '%${filter.value.replace(/'/g, "''")}%'`);
          }
          break;
        case 'BETWEEN':
          // Special handling for time fields
          if (['time_from', 'time_to'].includes(filter.column)) {
            const [startTime, endTime] = filter.value.split(',').map(v => v.trim());
            if (startTime && endTime) {
              whereConditions.push(`${filter.column} >= '${startTime.replace(/'/g, "''")}'`);
              whereConditions.push(`${filter.column} <= '${endTime.replace(/'/g, "''")}'`);
            }
          } else {
            // For other column types
            const [start, end] = filter.value.split(',').map(v => v.trim());
            if (start && end) {
              let formattedStart, formattedEnd;
              if (columnType === 'string') {
                formattedStart = `'${start.replace(/'/g, "''")}'`;
                formattedEnd = `'${end.replace(/'/g, "''")}'`;
              } else if (columnType === 'number') {
                formattedStart = `CAST(${start} AS INTEGER)`;
                formattedEnd = `CAST(${end} AS INTEGER)`;
              } else {
                formattedStart = typeof start === 'string' ? `'${start.replace(/'/g, "''")}'` : start;
                formattedEnd = typeof end === 'string' ? `'${end.replace(/'/g, "''")}'` : end;
              }
              whereConditions.push(`${filter.column} BETWEEN ${formattedStart} AND ${formattedEnd}`);
            }
          }
          break;
        case 'NOT BETWEEN':
          // For NOT BETWEEN operator
          const [notBetweenStart, notBetweenEnd] = filter.value.split(',').map(v => v.trim());
          if (notBetweenStart && notBetweenEnd) {
            let formattedStart, formattedEnd;
            if (columnType === 'string') {
              formattedStart = `'${notBetweenStart.replace(/'/g, "''")}'`;
              formattedEnd = `'${notBetweenEnd.replace(/'/g, "''")}'`;
            } else if (columnType === 'number') {
              formattedStart = `CAST(${notBetweenStart} AS INTEGER)`;
              formattedEnd = `CAST(${notBetweenEnd} AS INTEGER)`;
            } else {
              formattedStart = typeof notBetweenStart === 'string' ? `'${notBetweenStart.replace(/'/g, "''")}'` : notBetweenStart;
              formattedEnd = typeof notBetweenEnd === 'string' ? `'${notBetweenEnd.replace(/'/g, "''")}'` : notBetweenEnd;
            }
            whereConditions.push(`${filter.column} NOT BETWEEN ${formattedStart} AND ${formattedEnd}`);
          }
          break;
        case 'IN':
          // IN condition should have comma-separated values
          const inValues = filter.value.split(',').map(v => {
            const trimmed = v.trim();
            return columnType === 'string' ? `'${trimmed.replace(/'/g, "''")}'` : trimmed;
          }).join(', ');

          if (columnType === 'string') {
            whereConditions.push(`UPPER(${filter.column}) IN (${inValues.toUpperCase()})`);
          } else {
            whereConditions.push(`${filter.column} IN (${inValues})`);
          }
          break;
        case 'NOT IN':
          // NOT IN condition should have comma-separated values
          const notInValues = filter.value.split(',').map(v => {
            const trimmed = v.trim();
            return columnType === 'string' ? `'${trimmed.replace(/'/g, "''")}'` : trimmed;
          }).join(', ');

          if (columnType === 'string') {
            whereConditions.push(`UPPER(${filter.column}) NOT IN (${notInValues.toUpperCase()})`);
          } else {
            whereConditions.push(`${filter.column} NOT IN (${notInValues})`);
          }
          break;
        default:
          if (columnType === 'string') {
            whereConditions.push(`UPPER(${filter.column}) ${filter.operator} UPPER(${formattedValue})`);
          } else {
            whereConditions.push(`${filter.column} ${filter.operator} ${formattedValue}`);
          }
      }
    }
  });

  return whereConditions.join(' AND ');
}

/**
 * Handle the special case of time range filtering
 * @param filter Filter object with 'time' as column
 * @param whereConditions Array of WHERE conditions to add to
 */
function handleTimeRangeFilter(filter: Filter, whereConditions: string[]): void {
  // Get precision mode (default to 'overlap' if not set)
  const precision = (filter as any).precision || 'overlap';

  switch (filter.operator) {
    case 'BETWEEN':
      // Split the value by comma and handle potential formatting issues
      let startTime, endTime;

      if (filter.value.includes(',')) {
        [startTime, endTime] = filter.value.split(',').map(v => v.trim());
      } else {
        // If there's no comma, this is likely an error in the input
        // But we'll try to handle single value as both start and end
        startTime = filter.value.trim();
        endTime = filter.value.trim();
        console.warn('Time BETWEEN filter missing comma separator:', filter.value);
      }

      if (startTime && endTime) {
        switch (precision) {
          case 'overlap':
            // Overlapping: Activities that overlap with the time range at all
            // An activity overlaps if:
            // 1. Its start time is <= end of range AND
            // 2. Its end time is >= start of range
            whereConditions.push(`time_from <= '${endTime.replace(/'/g, "''")}'`);
            whereConditions.push(`time_to >= '${startTime.replace(/'/g, "''")}'`);
            break;

          case 'contain':
            // Contained Within: Activities that happen entirely within the time range
            // An activity is contained if:
            // 1. Its start time is >= start of range AND
            // 2. Its end time is <= end of range
            whereConditions.push(`time_from >= '${startTime.replace(/'/g, "''")}'`);
            whereConditions.push(`time_to <= '${endTime.replace(/'/g, "''")}'`);
            break;

          case 'start':
            // Starting In: Activities that start within the time range
            // An activity starts in the range if:
            // 1. Its start time is >= start of range AND
            // 2. Its start time is < end of range
            whereConditions.push(`time_from >= '${startTime.replace(/'/g, "''")}'`);
            whereConditions.push(`time_from < '${endTime.replace(/'/g, "''")}'`);
            break;
        }
      }
      break;
    case 'NOT BETWEEN':
      const [notStartTime, notEndTime] = filter.value.split(',').map(v => v.trim());
      if (notStartTime && notEndTime) {
        switch (precision) {
          case 'overlap':
            // NOT Overlapping: Activities that don't overlap with the time range at all
            // An activity doesn't overlap if:
            // 1. It ends before the range starts, OR
            // 2. It starts after the range ends
            whereConditions.push(`(time_to < '${notStartTime.replace(/'/g, "''")}' OR time_from > '${notEndTime.replace(/'/g, "''")}')`);
            break;

          case 'contain':
            // NOT Contained Within: Activities that aren't entirely contained within the time range
            // An activity isn't contained if:
            // 1. Its start time is < start of range, OR
            // 2. Its end time is > end of range
            whereConditions.push(`(time_from < '${notStartTime.replace(/'/g, "''")}' OR time_to > '${notEndTime.replace(/'/g, "''")}')`);
            break;

          case 'start':
            // NOT Starting In: Activities that don't start within the time range
            // An activity doesn't start in the range if:
            // 1. Its start time is < start of range, OR
            // 2. Its start time is >= end of range
            whereConditions.push(`(time_from < '${notStartTime.replace(/'/g, "''")}' OR time_from >= '${notEndTime.replace(/'/g, "''")}')`);
            break;
        }
      }
      break;
    case '=':
      // For equals, the behavior depends on precision
      if (filter.value) {
        const exactTime = filter.value.trim();
        switch (precision) {
          case 'overlap':
            // Activity happening at this exact time
            whereConditions.push(`time_from <= '${exactTime.replace(/'/g, "''")}'`);
            whereConditions.push(`time_to >= '${exactTime.replace(/'/g, "''")}'`);
            break;
          case 'contain':
          // Impossible to be contained at exact time point, use same as 'start'
          case 'start':
            // Activity starting at this exact time
            whereConditions.push(`time_from = '${exactTime.replace(/'/g, "''")}'`);
            break;
        }
      }
      break;
    case '!=':
      // For not equals, find activities not happening at this time
      if (filter.value) {
        const exactTime = filter.value.trim();
        switch (precision) {
          case 'overlap':
            // NOT happening at this exact time
            whereConditions.push(`(time_from > '${exactTime.replace(/'/g, "''")}' OR time_to < '${exactTime.replace(/'/g, "''")}')`);
            break;
          case 'contain':
          // Impossible to be contained at exact time point, use same as 'start'
          case 'start':
            // NOT starting at this exact time
            whereConditions.push(`time_from != '${exactTime.replace(/'/g, "''")}'`);
            break;
        }
      }
      break;
    case '>':
      // For greater than, behavior depends on precision
      if (filter.value) {
        const timeValue = filter.value.trim();
        switch (precision) {
          case 'overlap':
          case 'start':
            // Activity starting after this time
            whereConditions.push(`time_from > '${timeValue.replace(/'/g, "''")}'`);
            break;
          case 'contain':
            // Activity fully after this time
            whereConditions.push(`time_from > '${timeValue.replace(/'/g, "''")}'`);
            break;
        }
      }
      break;
    case '<':
      // For less than, behavior depends on precision
      if (filter.value) {
        const timeValue = filter.value.trim();
        switch (precision) {
          case 'overlap':
            // Activity ending before this time
            whereConditions.push(`time_to < '${timeValue.replace(/'/g, "''")}'`);
            break;
          case 'contain':
            // Activity fully before this time
            whereConditions.push(`time_to < '${timeValue.replace(/'/g, "''")}'`);
            break;
          case 'start':
            // Activity starting before this time
            whereConditions.push(`time_from < '${timeValue.replace(/'/g, "''")}'`);
            break;
        }
      }
      break;
    case '>=':
      // For greater than or equal, behavior depends on precision
      if (filter.value) {
        const timeValue = filter.value.trim();
        switch (precision) {
          case 'overlap':
          case 'start':
            // Activity starting at or after this time
            whereConditions.push(`time_from >= '${timeValue.replace(/'/g, "''")}'`);
            break;
          case 'contain':
            // Activity fully at or after this time
            whereConditions.push(`time_from >= '${timeValue.replace(/'/g, "''")}'`);
            break;
        }
      }
      break;
    case '<=':
      // For less than or equal, behavior depends on precision
      if (filter.value) {
        const timeValue = filter.value.trim();
        switch (precision) {
          case 'overlap':
            // Activity ending at or before this time
            whereConditions.push(`time_to <= '${timeValue.replace(/'/g, "''")}'`);
            break;
          case 'contain':
            // Activity fully at or before this time
            whereConditions.push(`time_to <= '${timeValue.replace(/'/g, "''")}'`);
            break;
          case 'start':
            // Activity starting at or before this time
            whereConditions.push(`time_from <= '${timeValue.replace(/'/g, "''")}'`);
            break;
        }
      }
      break;
    default:
      // For other operators, apply based on precision
      if (filter.value) {
        const timeValue = `'${filter.value.replace(/'/g, "''")}'`;
        switch (precision) {
          case 'overlap':
            // Apply to both start and end times
            whereConditions.push(`(time_from ${filter.operator} ${timeValue} OR time_to ${filter.operator} ${timeValue})`);
            break;
          case 'contain':
            // For containment, we'd need both time_from and time_to to satisfy the condition
            whereConditions.push(`(time_from ${filter.operator} ${timeValue} AND time_to ${filter.operator} ${timeValue})`);
            break;
          case 'start':
            // Apply only to start time
            whereConditions.push(`time_from ${filter.operator} ${timeValue}`);
            break;
        }
      }
  }
}

// Function to build a query based on selected columns and filters
export function buildQuery(
  selectedColumns: string[],
  filters: Filter[],
  currentPage: number,
  pageSize: number
): string {
  if (selectedColumns.length === 0) {
    return '';
  }

  // Build columns part
  const columnsStr = selectedColumns.join(', ');

  // Use the shared where clause builder
  const whereConditionsStr = buildWhereClause(filters);

  // Complete query with pagination
  let query = `SELECT ${columnsStr} FROM india_timeuse_survey`;

  if (whereConditionsStr) {
    query += ` WHERE ${whereConditionsStr}`;
  }

  // Add LIMIT and OFFSET for pagination
  const offset = (currentPage - 1) * pageSize;
  query += ` LIMIT ${pageSize} OFFSET ${offset}`;

  return query;
}

export function buildCountQuery(filters: Filter[]): string {
  // Use the shared where clause builder
  const whereConditionsStr = buildWhereClause(filters);

  let query = 'SELECT COUNT(*) AS count FROM india_timeuse_survey';

  if (whereConditionsStr) {
    query += ` WHERE ${whereConditionsStr}`;
  }

  return query;
}

// Function to run a query and return results
export async function runQuery(
  selectedColumns: string[],
  filters: Filter[],
  currentPage: number,
  pageSize: number
): Promise<{ results: any[], resultCount: number, totalPages: number }> {
  // Create a cache key from the query parameters
  const cacheParams = {
    type: 'raw_query',
    columns: selectedColumns,
    filters: filters.filter(f => f.enabled), // Only include enabled filters
    page: currentPage,
    size: pageSize
  };

  const cacheKey = generateQueryCacheKey(cacheParams);

  // Check for cached results
  const cachedResult = getCachedQueryResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const query = buildQuery(selectedColumns, filters, currentPage, pageSize);
  if (!query) {
    return { results: [], resultCount: 0, totalPages: 1 };
  }

  // Run count query first
  const countQuery = buildCountQuery(filters);
  const countResult = await executeQuery(countQuery);
  const countArray = countResult.toArray();

  let resultCount = 0;
  let totalPages = 1;

  if (countArray.length > 0) {
    let countValue = countArray[0].count;

    // Handle BigInt conversion for the count result
    if (typeof countValue === 'bigint') {
      // Convert BigInt to number if it's within safe integer range
      if (countValue <= Number.MAX_SAFE_INTEGER && countValue >= Number.MIN_SAFE_INTEGER) {
        countValue = Number(countValue);
      } else {
        // For very large values, convert to string and then parse
        countValue = parseInt(countValue.toString(), 10);
      }
    }

    resultCount = countValue;

    // Ensure pageSize is a number for calculation
    const pageSizeNum = Number(pageSize);
    totalPages = Math.ceil(Number(resultCount) / pageSizeNum);
  }

  // Run data query
  const result = await executeQuery(query);

  // Process results
  const results = result.toArray().map((row: any) => {
    // Convert row object to plain object
    const obj: Record<string, any> = {};

    // Check if row is an array-like object
    if (Array.isArray(row) || (typeof row === 'object' && 'length' in row)) {
      // Use index-based access
      selectedColumns.forEach((col, i) => {
        let value = row[i];

        // Handle BigInt conversion to regular numbers for display
        if (typeof value === 'bigint') {
          // Convert BigInt to number if it's within safe integer range
          if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
            value = Number(value);
          } else {
            // For very large values, convert to string to avoid precision loss
            value = value.toString();
          }
        }

        obj[col] = value;
      });
    } else {
      // Direct property access
      selectedColumns.forEach((col) => {
        let value = row[col];

        // Handle BigInt conversion to regular numbers for display
        if (typeof value === 'bigint') {
          // Convert BigInt to number if it's within safe integer range
          if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
            value = Number(value);
          } else {
            // For very large values, convert to string to avoid precision loss
            value = value.toString();
          }
        }

        obj[col] = value;
      });
    }
    return obj;
  });

  // Cache the result before returning
  const resultObj = { results, resultCount, totalPages };
  cacheQueryResult(cacheKey, resultObj);

  return resultObj;
}

// Function to run a summary query
export async function runSummaryQuery(
  aggregations: Aggregation[],
  groupByColumns: string[],
  filters: Filter[],
  columnTypesMap: Record<string, string>
): Promise<any[]> {
  // Create a cache key from the query parameters
  const cacheParams = {
    type: 'summary_query',
    aggregations,
    groupByColumns,
    filters: filters.filter(f => f.enabled) // Only include enabled filters
  };

  const cacheKey = generateQueryCacheKey(cacheParams);

  // Check for cached results
  const cachedResult = getCachedQueryResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Default to COUNT(*) if nothing is selected
  if (aggregations.length === 0 && groupByColumns.length === 0) {
    aggregations = [{ column: '*', function: 'COUNT' }];
  }

  const result = await executeSummaryQuery(aggregations, groupByColumns, filters, columnTypesMap);

  // Convert Apache Arrow result to plain objects
  const results = result.toArray().map((row: any) => {
    const obj: Record<string, any> = {};

    // Process columns - either group by columns or aggregation results
    const columns = [...groupByColumns];

    // Add aggregation result columns
    aggregations.forEach(agg => {
      let columnName;
      if (agg.function === 'COUNT' && agg.column === '*') {
        columnName = 'count_all';
      } else if (agg.function === 'COUNT' && agg.column !== '*') {
        columnName = `count_${agg.column}`;
      } else if (agg.function === 'COUNT_DISTINCT_PERSON') {
        columnName = 'count_distinct_person';
      } else if (agg.function === 'COUNT_DISTINCT' && agg.column === '*') {
        columnName = 'count_distinct_person_id';
      } else if (agg.function === 'COUNT_DISTINCT') {
        columnName = `count_distinct_${agg.column}`;
      } else {
        columnName = `${agg.function.toLowerCase()}_${agg.column}`;
      }
      columns.push(columnName);
    });

    // Map row values to column names
    if (Array.isArray(row) || (typeof row === 'object' && 'length' in row)) {
      // Handle array-like object
      columns.forEach((col, i) => {
        let value = row[i];

        // Handle BigInt conversion to regular numbers for display
        if (typeof value === 'bigint') {
          if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
            value = Number(value);
          } else {
            value = value.toString();
          }
        }

        obj[col] = value;
      });
    } else {
      // Handle direct property access
      columns.forEach(col => {
        let value = row[col];

        // Handle BigInt conversion to regular numbers for display
        if (typeof value === 'bigint') {
          if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
            value = Number(value);
          } else {
            value = value.toString();
          }
        }

        obj[col] = value;
      });
    }

    return obj;
  });

  // Cache the result before returning
  cacheQueryResult(cacheKey, results);

  return results;
}

// Function to run time analysis
export async function runTimeAnalysis(
  demographicColumns: string[],
  activityColumn: string,
  filters: Filter[],
  columnTypesMap: Record<string, string>,
  useWeightedAverage: boolean = false
): Promise<any[]> {
  // Create a cache key from the query parameters
  const cacheParams = {
    type: 'time_analysis',
    demographicColumns,
    activityColumn,
    filters: filters.filter(f => f.enabled), // Only include enabled filters
    useWeightedAverage // Include in cache key so weighted/unweighted are cached separately
  };

  const cacheKey = generateQueryCacheKey(cacheParams);

  // Check for cached results
  const cachedResult = getCachedQueryResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  if (demographicColumns.length === 0) {
    throw new Error('Please select at least one demographic column to group by');
  }

  const result = await calculateTimeSpentByDemographic(
    demographicColumns,
    activityColumn,
    filters,
    columnTypesMap,
    useWeightedAverage
  );

  // Convert Apache Arrow result to plain objects
  const results = result.toArray().map((row: any) => {
    const obj: Record<string, any> = {};

    // Process all columns
    const columns = [...demographicColumns];
    if (activityColumn && activityColumn !== '*') {
      columns.push(activityColumn);
    }

    // Add calculated columns
    columns.push('avg_minutes', 'total_minutes', 'activity_count');

    // Map row values to column names
    if (Array.isArray(row) || (typeof row === 'object' && 'length' in row)) {
      // Handle array-like object
      columns.forEach((col, i) => {
        let value = row[i];

        // Handle BigInt conversion to regular numbers for display
        if (typeof value === 'bigint') {
          if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
            value = Number(value);
          } else {
            value = value.toString();
          }
        }

        obj[col] = value;
      });
    } else {
      // Handle direct property access
      columns.forEach(col => {
        let value = row[col];

        // Handle BigInt conversion to regular numbers for display
        if (typeof value === 'bigint') {
          if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
            value = Number(value);
          } else {
            value = value.toString();
          }
        }

        obj[col] = value;
      });
    }

    return obj;
  });

  // Cache the result before returning
  cacheQueryResult(cacheKey, results);

  return results;
} 