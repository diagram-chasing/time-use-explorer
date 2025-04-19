import { browser } from '$app/environment';
import { dbCore } from './dbCore';
import type { ColumnInfo } from './service';
import { cacheHelper } from '../duckdb/cacheHelper';
import { notifications } from '$lib/utils/notificationUtils';

/**
 * Execute a SQL query with the DuckDB instance
 * @param query SQL query to execute
 * @returns Raw DuckDB query result
 */
async function executeQuery(query: string): Promise<any> {
  return cacheHelper.executeQueryWithCache(async () => {
    const db = dbCore.getDatabase();
    if (!db) {
      const errorMsg = 'DuckDB is not initialized';
      notifications.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Create a new connection for this query
    const conn = await db.connect();
    
    try {
      // Execute query and return the raw result
      console.log(`Executing query: ${query}`);
      return await conn.query(query);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      notifications.error(`Query error: ${errorMessage}`);
      throw error;
    } finally {
      await conn.close();
    }
  });
}

/**
 * Get column information from the survey table
 * @returns Array of column info objects
 */
async function getColumns(): Promise<ColumnInfo[]> {
  const result = await executeQuery(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'india_timeuse_survey'
  `);
  
  // Process the result after getting the raw DuckDB result
  const rows = result.toArray();
  return rows.map((row: any) => ({
    name: row.column_name as string,
    type: row.data_type as string
  }));
}

/**
 * Get a preview of the survey data
 * @returns Sample rows from the survey
 */
async function getPreview(): Promise<any> {
  return executeQuery(`
    SELECT * FROM india_timeuse_sample LIMIT 100
  `);
}

/**
 * Execute a summary query with grouping and aggregation
 * @param aggregations List of aggregation functions and columns
 * @param groupByColumns List of columns to group by
 * @param filters List of filter conditions
 * @param columnTypes Map of column types for proper value formatting
 * @returns Raw DuckDB query result
 */
async function executeSummaryQuery(
  aggregations: Array<{column: string, function: string}>,
  groupByColumns: string[],
  filters: Array<{column: string, operator: string, value: string, enabled: boolean, precision?: string}>,
  columnTypes: Record<string, string>
): Promise<any> {
  // Create a cache key for this query
  const cacheKey = `summary_${JSON.stringify({ aggregations, groupByColumns, filters })}`;
  
  return cacheHelper.executeQueryWithCache(async () => {
    const db = dbCore.getDatabase();
    if (!db) {
      throw new Error('DuckDB is not initialized');
    }
    
    // Build the aggregation part
    const aggregationClauses = aggregations.map(agg => {
      // Handle different counting methods with clear, intuitive SQL
      if (agg.function === 'COUNT') {
        if (agg.column === '*') {
          // Standard row count
          return `COUNT(*) AS count_all`;
        } else {
          // Count non-null values in the specified column
          return `COUNT(${agg.column}) AS count_${agg.column}`;
        }
      } else if (agg.function === 'COUNT_DISTINCT_PERSON') {
        // Always count distinct person_ids (unique people)
        return `COUNT(DISTINCT person_id) AS count_distinct_person`;
      } else if (agg.function === 'COUNT_DISTINCT') {
        if (agg.column === '*') {
          // Default to person_id if * is selected for distinct counting
          return `COUNT(DISTINCT person_id) AS count_distinct_person_id`;
        } else {
          // Count distinct values in the specified column
          return `COUNT(DISTINCT ${agg.column}) AS count_distinct_${agg.column}`;
        }
      } else {
        // Standard aggregation functions (AVG, SUM, MIN, MAX, etc.)
        return `${agg.function}(${agg.column}) AS ${agg.function.toLowerCase()}_${agg.column}`;
      }
    });
    
    // Build the GROUP BY part
    const groupByClauses = [...groupByColumns];
    
    // Build the WHERE clause
    const whereConditions: string[] = [];
    filters.forEach(filter => {
      if (filter.enabled && filter.value) {
        // Handle special virtual 'time' column
        if (filter.column === 'time') {
          handleTimeFilter(filter, whereConditions);
          return;
        }
        
        // Use column types from the columnTypes map
        const columnType = columnTypes[filter.column] || 'string';
        
        let formattedValue;
        if (columnType === 'string') {
          formattedValue = `'${filter.value.replace(/'/g, "''")}'`;
        } else if (columnType === 'number') {
          formattedValue = `CAST(${filter.value} AS INTEGER)`;
        } else {
          formattedValue = typeof filter.value === 'string' ? `'${filter.value.replace(/'/g, "''")}'` : filter.value;
        }
        
        // Build the condition based on operator
        switch (filter.operator) {
          case '=':
            if (columnType === 'string') {
              whereConditions.push(`UPPER(${filter.column}) = UPPER(${formattedValue})`);
            } else {
              whereConditions.push(`${filter.column} = ${formattedValue}`);
            }
            break;
          case '!=':
            if (columnType === 'string') {
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
            if (columnType === 'string') {
              whereConditions.push(`UPPER(${filter.column}) LIKE UPPER('%${filter.value.replace(/'/g, "''")}%')`);
            } else {
              whereConditions.push(`${filter.column} LIKE '%${filter.value.replace(/'/g, "''")}%'`);
            }
            break;
          case 'NOT LIKE':
            if (columnType === 'string') {
              whereConditions.push(`UPPER(${filter.column}) NOT LIKE UPPER('%${filter.value.replace(/'/g, "''")}%')`);
            } else {
              whereConditions.push(`${filter.column} NOT LIKE '%${filter.value.replace(/'/g, "''")}%'`);
            }
            break;
          case 'BETWEEN':
            // Handle BETWEEN for time values
            if (['time_from', 'time_to'].includes(filter.column)) {
              // Properly handle potential missing comma in the value
              let startTime, endTime;
              if (filter.value.includes(',')) {
                [startTime, endTime] = filter.value.split(',').map(v => {
                  // Format with leading zeros for proper time comparison
                  const trimmed = v.trim();
                  if (trimmed.includes(':') && trimmed.indexOf(':') === 1) {
                    return '0' + trimmed;
                  }
                  return trimmed;
                });
              } else {
                // Format with leading zeros
                let timeValue = filter.value.trim();
                if (timeValue.includes(':') && timeValue.indexOf(':') === 1) {
                  timeValue = '0' + timeValue;
                }
                startTime = timeValue;
                endTime = timeValue;
                console.warn('BETWEEN filter missing comma separator:', filter.value);
              }
              
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
          default:
            if (columnType === 'string') {
              whereConditions.push(`UPPER(${filter.column}) ${filter.operator} UPPER(${formattedValue})`);
            } else {
              whereConditions.push(`${filter.column} ${filter.operator} ${formattedValue}`);
            }
        }
      }
    });
    
    // Assemble the clauses
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    const groupByClause = groupByClauses.length > 0 
      ? `GROUP BY ${groupByClauses.join(', ')}` 
      : '';
    
    const selectClauses = [
      ...groupByClauses,
      ...aggregationClauses
    ];
    
    // Build the complete query
    const query = `
      SELECT ${selectClauses.join(', ')}
      FROM india_timeuse_survey
      ${whereClause}
      ${groupByClause}
      ${groupByClause ? 'ORDER BY ' + groupByClauses[0] : ''}
    `;
    
    // Execute the query
    const conn = await db.connect();
    
    try {
      console.log(`Executing summary query: ${query}`);
      return await conn.query(query);
    } finally {
      await conn.close();
    }
  }, cacheKey);
}

/**
 * Analyze time spent by demographic groups
 * @param demographicColumns Columns to group by
 * @param activityColumn Activity column for grouping
 * @param filters List of filter conditions
 * @param columnTypes Map of column types for value formatting
 * @returns Raw DuckDB query result
 */
async function calculateTimeSpentByDemographic(
  demographicColumns: string[],
  activityColumn: string = 'activity_code',
  filters: Array<{column: string, operator: string, value: string, enabled: boolean, precision?: string}>,
  columnTypes: Record<string, string>
): Promise<any> {
  if (demographicColumns.length === 0) {
    throw new Error('At least one demographic column must be specified');
  }
  
  // Build GROUP BY clause
  const groupByColumns = [...demographicColumns];
  if (activityColumn && activityColumn !== '*') {
    groupByColumns.push(activityColumn);
  }
  
  const groupByClause = `GROUP BY ${groupByColumns.join(', ')}`;
  
  // Build WHERE clause for filters
  let whereConditions: string[] = [];
  filters.forEach(filter => {
    if (filter.enabled && filter.value) {
      // Handle special virtual 'time' column
      if (filter.column === 'time') {
        handleTimeFilter(filter, whereConditions);
        return;
      }
      
      // Format value based on column type
      let formattedValue;
      
      if (columnTypes[filter.column] === 'string') {
        // For string types, wrap in quotes
        formattedValue = `'${filter.value.replace(/'/g, "''")}'`;
      } else if (columnTypes[filter.column] === 'number') {
        // For numeric types, cast to INTEGER
        formattedValue = `CAST(${filter.value} AS INTEGER)`;
      } else {
        // Default case
        formattedValue = typeof filter.value === 'string' ? `'${filter.value.replace(/'/g, "''")}'` : filter.value;
      }
      
      // Build the condition based on operator
      switch (filter.operator) {
        case '=':
          if (columnTypes[filter.column] === 'string') {
            whereConditions.push(`UPPER(${filter.column}) = UPPER(${formattedValue})`);
          } else {
            whereConditions.push(`${filter.column} = ${formattedValue}`);
          }
          break;
        case '!=':
          if (columnTypes[filter.column] === 'string') {
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
          if (columnTypes[filter.column] === 'string') {
            whereConditions.push(`UPPER(${filter.column}) LIKE UPPER('%${filter.value.replace(/'/g, "''")}%')`);
          } else {
            whereConditions.push(`${filter.column} LIKE '%${filter.value.replace(/'/g, "''")}%'`);
          }
          break;
        case 'NOT LIKE':
          if (columnTypes[filter.column] === 'string') {
            whereConditions.push(`UPPER(${filter.column}) NOT LIKE UPPER('%${filter.value.replace(/'/g, "''")}%')`);
          } else {
            whereConditions.push(`${filter.column} NOT LIKE '%${filter.value.replace(/'/g, "''")}%'`);
          }
          break;
        case 'BETWEEN':
          // Handle BETWEEN for time values
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
              if (columnTypes[filter.column] === 'string') {
                formattedStart = `'${start.replace(/'/g, "''")}'`;
                formattedEnd = `'${end.replace(/'/g, "''")}'`;
              } else if (columnTypes[filter.column] === 'number') {
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
        default:
          if (columnTypes[filter.column] === 'string') {
            whereConditions.push(`UPPER(${filter.column}) ${filter.operator} UPPER(${formattedValue})`);
          } else {
            whereConditions.push(`${filter.column} ${filter.operator} ${formattedValue}`);
          }
      }
    }
  });
  
  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';
  
  // Always use the full dataset for time spent queries
  const tableName = 'india_timeuse_survey';
  
  // Build the query - note we're not including time_from and time_to in SELECT
  // as they're aggregated with the time_diff_minutes function
  const query = `
    SELECT 
      ${groupByColumns.join(', ')},
      AVG(time_diff_minutes(time_from, time_to)) AS avg_minutes,
      SUM(time_diff_minutes(time_from, time_to)) AS total_minutes,
      COUNT(DISTINCT person_id) AS activity_count
    FROM ${tableName}
    ${whereClause}
    ${groupByClause}
    ORDER BY ${groupByColumns.join(', ')}
  `;
  
  console.log(`Executing time spent query on full dataset: ${query}`);
  return executeQuery(query);
}

// Handle the special time virtual column
function handleTimeFilter(
  filter: {column: string, operator: string, value: string, enabled: boolean, precision?: string}, 
  whereConditions: string[]
): void {
  // Default to 'overlap' precision if not specified
  const precision = filter.precision || 'overlap';
  
  // Helper function to format time strings with leading zeros
  function formatTimeWithLeadingZeros(timeStr: string): string {
    const trimmed = timeStr.trim();
    // If there's a colon and the hour part is a single digit, pad with zero
    if (trimmed.includes(':') && trimmed.indexOf(':') === 1) {
      return '0' + trimmed;
    }
    return trimmed;
  }
  
  switch (filter.operator) {
    case 'BETWEEN':
      // Split the value properly
      let startTime, endTime;
      if (filter.value.includes(',')) {
        [startTime, endTime] = filter.value.split(',').map(v => formatTimeWithLeadingZeros(v.trim()));
      } else {
        // If no comma, use the same value for both or handle as error
        startTime = formatTimeWithLeadingZeros(filter.value.trim());
        endTime = startTime;
        console.warn('Time BETWEEN filter missing comma separator:', filter.value);
      }
      
      if (startTime && endTime) {
        switch (precision) {
          case 'overlap':
            // Activities that overlap with the time range
            // An activity overlaps if it starts before the range ends AND ends after the range starts
            whereConditions.push(`time_from <= '${endTime.replace(/'/g, "''")}'`);
            whereConditions.push(`time_to >= '${startTime.replace(/'/g, "''")}'`);
            break;
          case 'contain':
            // Activities fully contained within the time range
            // An activity is contained if it starts after range starts AND ends before range ends
            whereConditions.push(`time_from >= '${startTime.replace(/'/g, "''")}'`);
            whereConditions.push(`time_to <= '${endTime.replace(/'/g, "''")}'`);
            break;
          default:
            // Default to overlap behavior
            whereConditions.push(`time_from <= '${endTime.replace(/'/g, "''")}'`);
            whereConditions.push(`time_to >= '${startTime.replace(/'/g, "''")}'`);
        }
      } else {
        console.error('Invalid time range values:', filter.value);
      }
      break;
    case '=':
      // Activity happening at exact time
      if (filter.value) {
        const time = formatTimeWithLeadingZeros(filter.value.trim());
        whereConditions.push(`time_from <= '${time.replace(/'/g, "''")}'`);
        whereConditions.push(`time_to >= '${time.replace(/'/g, "''")}'`);
      }
      break;
    default:
      // For other operators, use time_from as the reference point
      if (filter.value) {
        const time = `'${formatTimeWithLeadingZeros(filter.value.trim()).replace(/'/g, "''")}'`;
        whereConditions.push(`time_from ${filter.operator} ${time}`);
      }
  }
}

/**
 * Execute a query directly against the parquet file
 * @param query SQL query to execute
 * @returns Raw DuckDB query result
 */
async function executeDirectParquetQuery(query: string): Promise<any> {
  // Make sure we're in a browser environment
  if (!browser) {
    throw new Error("DuckDB queries can only be executed in browser environment");
  }
  
  // Make sure DB is initialized
  const db = await dbCore.initDuckDB();
  
  console.log(`Executing direct parquet query: ${query}`);
  const conn = await db.connect();
  
  try {
    // Replace table references with direct parquet_scan
    const modifiedQuery = query.replace(
      /FROM\s+india_timeuse_survey/gi, 
      `FROM parquet_scan('india_timeuse_survey.parquet')`
    );
    
    console.log(`Modified query: ${modifiedQuery}`);
    return await conn.query(modifiedQuery);
  } catch (error) {
    console.error("Error executing direct parquet query:", error);
    throw error;
  } finally {
    await conn.close();
  }
}

// Export query functions
export const queryExecutor = {
  executeQuery,
  getColumns,
  getPreview,
  executeSummaryQuery,
  calculateTimeSpentByDemographic,
  executeDirectParquetQuery
}; 