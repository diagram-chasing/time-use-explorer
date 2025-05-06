import Papa from 'papaparse';

// Function to download data as CSV
export function downloadCSV(data: any[], filename: string): void {
  if (!data.length) return;

  // Get all available columns from the first row
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];

      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      } else if (typeof value === 'string') {
        // Escape quotes and wrap in quotes if needed
        return `"${value.replace(/"/g, '""')}"`;
      } else if (typeof value === 'bigint') {
        // Convert BigInt to string
        return value.toString();
      } else {
        return value;
      }
    });

    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Function to download raw data as CSV (just for current page)
export function downloadRawDataCSV(results: any[], selectedColumns: string[]): void {
  if (!results.length) return;

  const headers = selectedColumns.filter(col => col !== 'person_id');
  const csvRows = [headers.join(',')];

  for (const row of results) {
    const values = headers.map(header => {
      const value = row[header];

      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      } else if (typeof value === 'string') {
        // Escape quotes and wrap in quotes if needed
        return `"${value.replace(/"/g, '""')}"`;
      } else if (typeof value === 'bigint') {
        // Convert BigInt to string
        return value.toString();
      } else {
        return value;
      }
    });

    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'data-export.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Function to download full raw data using DuckDB's native capabilities
// This avoids browser memory limitations for large datasets
export async function downloadFullDataWithDuckDB(
  selectedColumns: string[],
  filters: any[],
  executeQueryFn: Function
): Promise<void> {
  try {
    // Show downloading notification
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { message: 'Preparing dataset for download...', type: 'info' }
      }));
    }

    // Build WHERE clause from filters
    const whereConditions: string[] = [];
    filters.forEach(filter => {
      if (filter.enabled && filter.value) {
        // Simplified filter handling - this would need to match your actual query builder logic
        if (filter.operator === '=') {
          if (typeof filter.value === 'string') {
            whereConditions.push(`${filter.column} = '${filter.value.replace(/'/g, "''")}'`);
          } else {
            whereConditions.push(`${filter.column} = ${filter.value}`);
          }
        } else if (filter.operator === '>') {
          whereConditions.push(`${filter.column} > ${filter.value}`);
        } else if (filter.operator === '<') {
          whereConditions.push(`${filter.column} < ${filter.value}`);
        } else {
          if (typeof filter.value === 'string') {
            whereConditions.push(`${filter.column} ${filter.operator} '${filter.value.replace(/'/g, "''")}'`);
          } else {
            whereConditions.push(`${filter.column} ${filter.operator} ${filter.value}`);
          }
        }
      }
    });

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // First, run a count query to see if we need chunking
    const countQuery = `SELECT COUNT(*) as count FROM india_timeuse_survey ${whereClause}`;
    const countResult = await executeQueryFn(countQuery);

    let rowCount = 0;
    if (countResult && countResult.toArray && typeof countResult.toArray === 'function') {
      const countRows = countResult.toArray();
      if (countRows.length > 0) {
        rowCount = Number(countRows[0][0]); // Get count value
      }
    }

    // Clear the count result to free memory
    if (countResult && countResult.clear && typeof countResult.clear === 'function') {
      countResult.clear();
    }

    // For small result sets (<10,000 rows), use direct query approach
    if (rowCount < 10000) {
      // Build and execute the query directly - stream to CSV
      const query = `
        SELECT ${selectedColumns.join(', ')}
        FROM india_timeuse_survey
        ${whereClause}
        LIMIT 50000
      `;

      // Execute the query to get results directly
      const result = await executeQueryFn(query);

      try {
        if (!result || (Array.isArray(result) && result.length === 0) ||
          (result.toArray && result.toArray().length === 0)) {
          if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
            window.dispatchEvent(new CustomEvent('notification', {
              detail: { message: 'No data to export', type: 'error' }
            }));
          }
          return;
        }

        // Convert the Arrow result to CSV format and download
        const csvContent = tableToArrowCSV(result);

        // Clear the result to free memory
        if (result && result.clear && typeof result.clear === 'function') {
          result.clear();
        }

        downloadCSVBlob(csvContent, 'data-export.csv');

        // Show success notification
        if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
          window.dispatchEvent(new CustomEvent('data_exported', {
            detail: { type: 'Full raw data' }
          }));
        }
      } finally {
        // Always try to clean up
        if (result && result.clear && typeof result.clear === 'function') {
          result.clear();
        }

        // Force garbage collection if available
        if (window.gc) {
          try {
            window.gc();
          } catch (e) {
            console.log('Manual garbage collection not supported');
          }
        }
      }
    } else {
      // For larger datasets, recommend using the chunked approach
      throw new Error(`Dataset is too large (${rowCount.toLocaleString()} rows). Using chunked export instead.`);
    }
  } catch (error) {
    console.error('Error exporting data with DuckDB:', error);

    // Show error notification with a helpful message about the size
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('db_error', {
        detail: {
          message: `Error exporting dataset: ${error}. Using chunked export instead.`
        }
      }));
    }

    // Re-throw to trigger fallback to chunked export
    throw error;
  }
}

// Helper function to download a CSV blob
function downloadCSVBlob(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke the URL to free memory
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

// Implements a chunked export approach for very large datasets
// This exports data page by page to avoid memory issues
export async function exportLargeDatasetInChunks(
  selectedColumns: string[],
  filters: any[],
  totalCount: number,
  runQueryFn: Function,
  chunkSize: number = 10000
): Promise<void> {
  try {
    // Show downloading notification
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { message: 'Starting progressive export of large dataset...', type: 'info' }
      }));
    }

    // Make sure we have a reasonable total count
    if (!totalCount || totalCount <= 0) {
      throw new Error('Invalid row count for chunked export');
    }

    // Adjust chunk size based on dataset size to prevent excessive chunking for small datasets
    if (totalCount < 10000) {
      chunkSize = totalCount;
    } else if (totalCount < 50000) {
      chunkSize = 5000;
    }

    // Create a blob parts array to store chunks
    const blobParts: BlobPart[] = [];

    // Add CSV header as first part
    const header = selectedColumns.join(',') + '\n';
    blobParts.push(header);

    // Calculate total number of chunks
    const totalChunks = Math.ceil(totalCount / chunkSize);

    // Process each chunk
    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const chunkPage = chunk + 1;

      // Update progress notification every few chunks
      if (chunk % 3 === 0 || chunk === totalChunks - 1) {
        if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
          const progressPct = Math.round(((chunk + 1) / totalChunks) * 100);
          window.dispatchEvent(new CustomEvent('notification', {
            detail: {
              message: `Exporting data: ${progressPct}% complete (chunk ${chunk + 1}/${totalChunks})`,
              type: 'info'
            }
          }));
        }
      }

      try {
        // Fetch the current chunk
        const { results } = await runQueryFn(
          selectedColumns,
          filters,
          chunkPage,
          chunkSize
        );

        if (!results || !results.length) continue;

        // Process this chunk's rows without headers
        let chunkRows = '';

        for (const row of results) {
          const values = selectedColumns.map(header => {
            const value = row[header];

            // Handle different data types
            if (value === null || value === undefined) {
              return '';
            } else if (typeof value === 'string') {
              // Escape quotes and wrap in quotes if needed
              return `"${value.replace(/"/g, '""')}"`;
            } else if (typeof value === 'bigint') {
              // Convert BigInt to string
              return value.toString();
            } else {
              return value;
            }
          });

          chunkRows += values.join(',') + '\n';
        }

        // Add this chunk to the blob parts
        blobParts.push(chunkRows);

        // Explicitly clear references to help garbage collection
        chunkRows = '';
      } catch (chunkError) {
        console.error(`Error processing chunk ${chunkPage}:`, chunkError);
        if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
          window.dispatchEvent(new CustomEvent('notification', {
            detail: {
              message: `Error processing chunk ${chunkPage}: ${chunkError}. The export may be incomplete.`,
              type: 'warning'
            }
          }));
        }
      }

      // Force a small delay between chunks to allow UI updates and garbage collection
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Create the final blob with all chunks
    const blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'full-data-export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    blobParts.length = 0; // Clear array

    setTimeout(() => {
      URL.revokeObjectURL(url);

      // Force garbage collection if available
      if (window.gc) {
        try {
          window.gc();
        } catch (e) {
          console.log('Manual garbage collection not supported');
        }
      }
    }, 100);

    // Show success notification
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('data_exported', {
        detail: { type: 'Full dataset (chunked export)' }
      }));
    }
  } catch (error) {
    console.error('Error during chunked export:', error);

    // Show error notification
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('db_error', {
        detail: { message: `Error during chunked export: ${error}` }
      }));
    }
  }
}

// Function to download the full dataset as CSV (not paginated)
export async function downloadFullRawDataCSV(
  selectedColumns: string[],
  filters: any[],
  runQueryFn: Function
): Promise<void> {
  try {
    // Show downloading notification
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { message: 'Preparing full dataset for download...', type: 'info' }
      }));
    }

    // Run the query for all data (no pagination)
    const { results } = await runQueryFn(
      selectedColumns,
      filters,
      1, // Page 1
      Number.MAX_SAFE_INTEGER // Effectively no limit
    );

    if (!results.length) {
      if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: { message: 'No data to export', type: 'error' }
        }));
      }
      return;
    }

    const headers = selectedColumns.filter(col => col !== 'person_id');
    const csvRows = [headers.join(',')];

    for (const row of results) {
      const values = headers.map(header => {
        const value = row[header];

        // Handle different data types
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if needed
          return `"${value.replace(/"/g, '""')}"`;
        } else if (typeof value === 'bigint') {
          // Convert BigInt to string
          return value.toString();
        } else {
          return value;
        }
      });

      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'full-data-export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success notification
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('data_exported', {
        detail: { type: 'Full raw data' }
      }));
    }
  } catch (error) {
    console.error('Error downloading full dataset:', error);

    // Show error notification
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('db_error', {
        detail: { message: `Error exporting full dataset: ${error}` }
      }));
    }
  }
}

// Convert Arrow table directly to CSV without intermediate JSON stage
function tableToArrowCSV(table: any): string {
  try {
    // Get column names from schema
    const columns = table.schema.fields.map((f: any) => f.name);

    // Create header row
    const csvRows = [columns.join(',')];

    // Get rows
    const rows = table.toArray();

    // Convert rows to CSV in batches to reduce memory pressure
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      let batchText = '';

      for (const row of batch) {
        const values = columns.map((col: string, idx: number) => {
          const value = row[idx];

          // Handle different data types
          if (value === null || value === undefined) {
            return '';
          } else if (typeof value === 'string') {
            // Escape quotes and wrap in quotes if needed
            return `"${value.replace(/"/g, '""')}"`;
          } else if (typeof value === 'bigint') {
            // Convert BigInt to string
            return value.toString();
          } else {
            return value;
          }
        });

        batchText += values.join(',') + '\n';
      }

      csvRows.push(batchText);
    }

    return csvRows.join('');
  } catch (error) {
    console.error('Error converting Arrow table to CSV:', error);
    throw error;
  }
}

// Helper function to convert table to CSV using Papaparse
function tableToCSV(table: any): string {
  // Convert Arrow Table to array of objects
  const rows = table.toArray().map((row: any) => {
    const obj: Record<string, any> = {};
    table.schema.fields.forEach((field: any, i: number) => {
      obj[field.name] = row[i];
    });
    return obj;
  });

  // Convert to CSV using Papaparse
  return Papa.unparse(rows);
}

// Function to download summary data as CSV
export function downloadSummaryCSV(summaryResults: any[]): void {
  downloadCSV(summaryResults, 'summary-data-export.csv');
}

// Function to download time analysis data as CSV
export function downloadTimeAnalysisCSV(timeAnalysisResults: any[]): void {
  downloadCSV(timeAnalysisResults, 'time-analysis-export.csv');
}

// For TypeScript
declare global {
  interface Window {
    gc?: () => void;
  }
} 