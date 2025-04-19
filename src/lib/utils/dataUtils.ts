// Function to sort time analysis results
export function sortTimeResults(
  timeAnalysisResults: any[],
  column: string,
  currentSortColumn: string,
  currentSortDirection: 'asc' | 'desc'
): { results: any[], sortColumn: string, sortDirection: 'asc' | 'desc' } {
  // If clicking the same column, toggle direction
  let newSortDirection: 'asc' | 'desc';
  let newSortColumn: string;
  
  if (currentSortColumn === column) {
    newSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    newSortColumn = currentSortColumn;
  } else {
    // New column, default to descending for numeric columns (showing highest values first)
    newSortColumn = column;
    // Default to descending for all numeric columns and columns containing these words
    newSortDirection = column.includes('count') || 
                      column.includes('minutes') || 
                      column.includes('avg') || 
                      column.includes('sum') || 
                      column.includes('total') || 
                      ['avg_minutes', 'total_minutes', 'activity_count'].includes(column) 
                      ? 'desc' : 'asc';
  }
  
  // Sort the results array
  const sortedResults = [...timeAnalysisResults].sort((a, b) => {
    const valueA = a[column];
    const valueB = b[column];
    
    // Handle null/undefined values
    if (valueA === null || valueA === undefined) return 1;
    if (valueB === null || valueB === undefined) return -1;
    
    // Sort differently based on type
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return newSortDirection === 'asc' 
        ? valueA - valueB 
        : valueB - valueA;
    } else {
      // String comparison
      const stringA = String(valueA).toLowerCase();
      const stringB = String(valueB).toLowerCase();
      return newSortDirection === 'asc'
        ? stringA.localeCompare(stringB)
        : stringB.localeCompare(stringA);
    }
  });
  
  return {
    results: sortedResults,
    sortColumn: newSortColumn,
    sortDirection: newSortDirection
  };
}

// Function to create a column types map
export function createColumnTypesMap(columns: Array<{id: string, type: string}>): Record<string, string> {
  const columnTypesMap: Record<string, string> = {};
  columns.forEach(col => {
    columnTypesMap[col.id] = col.type;
  });
  return columnTypesMap;
}

// Function to toggle a column in an array
export function toggleColumn(columns: string[], column: string): string[] {
  if (columns.includes(column)) {
    return columns.filter(c => c !== column);
  } else {
    return [...columns, column];
  }
}

// Function to add a filter
export function addFilter(filters: Array<{column: string, operator: string, value: string, enabled: boolean}>): Array<{column: string, operator: string, value: string, enabled: boolean}> {
  return [...filters, { column: 'age', operator: '=', value: '', enabled: true }];
}

// Function to remove a filter
export function removeFilter(filters: Array<{column: string, operator: string, value: string, enabled: boolean}>, index: number): Array<{column: string, operator: string, value: string, enabled: boolean}> {
  return filters.filter((_, i) => i !== index);
}

// Function to add an aggregation
export function addAggregation(aggregations: Array<{column: string, function: string}>, numericColumn: string): Array<{column: string, function: string}> {
  return [...aggregations, { column: numericColumn, function: 'COUNT' }];
}

// Function to remove an aggregation
export function removeAggregation(aggregations: Array<{column: string, function: string}>, index: number): Array<{column: string, function: string}> {
  return aggregations.filter((_, i) => i !== index);
}

// Function to toggle a group by column
export function toggleGroupByColumn(groupByColumns: string[], column: string): string[] {
  if (groupByColumns.includes(column)) {
    return groupByColumns.filter(c => c !== column);
  } else {
    return [...groupByColumns, column];
  }
}

// Function to toggle a demographic column
export function toggleDemographicColumn(demographicColumns: string[], column: string): string[] {
  if (demographicColumns.includes(column)) {
    return demographicColumns.filter(c => c !== column);
  } else {
    return [...demographicColumns, column];
  }
} 