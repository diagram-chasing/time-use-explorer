import Papa from 'papaparse';

/**
 * Convert an Arrow Table to CSV format
 * @param table Apache Arrow table
 * @returns CSV formatted string
 */
function tableToCSV(table: any): string {
  // Convert Arrow Table to array of objects
  const rows = table.toArray().map((row: any) => {
    const obj: Record<string, any> = {};
    table.schema.fields.forEach((field: any, i: number) => {
      obj[field.name] = row[i];
    });
    return obj;
  });
  
  // Convert to CSV
  return Papa.unparse(rows);
}

/**
 * Convert BigInt values to JavaScript numbers or strings
 * to prevent serialization issues
 * @param value Value to convert
 * @returns Converted value
 */
function convertBigIntValue(value: any): any {
  if (typeof value === 'bigint') {
    // Convert BigInt to number if it's within safe integer range
    if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
      return Number(value);
    } else {
      // For very large values, convert to string
      return value.toString();
    }
  }
  return value;
}

/**
 * Format time value with custom formatter
 * @param minutes Minutes value to format
 * @param compact Whether to use compact format
 * @returns Formatted time string
 */
function formatTimeValue(minutes: number, compact: boolean = false): string {
  if (!compact) {
    return `${minutes.toFixed(1)} min`;
  }
  
  // Compact formatter
  if (minutes >= 1e9) {
    return `${(minutes / 1e9).toFixed(1)} B min`;
  } else if (minutes >= 1e6) {
    return `${(minutes / 1e6).toFixed(1)} M min`;
  } else if (minutes >= 1e3) {
    return `${(minutes / 1e3).toFixed(1)} K min`;
  } else {
    return `${minutes.toFixed(1)} min`;
  }
}

// Export data conversion utilities
export const dataConverters = {
  tableToCSV,
  convertBigIntValue,
  formatTimeValue
}; 