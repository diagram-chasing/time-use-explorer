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

// Function to download raw data as CSV
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

// Function to download summary data as CSV
export function downloadSummaryCSV(summaryResults: any[]): void {
  downloadCSV(summaryResults, 'summary-data-export.csv');
}

// Function to download time analysis data as CSV
export function downloadTimeAnalysisCSV(timeAnalysisResults: any[]): void {
  downloadCSV(timeAnalysisResults, 'time-analysis-export.csv');
} 