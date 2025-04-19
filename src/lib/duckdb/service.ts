// Import modules for DuckDB functionality
import { dbCore } from './dbCore';
import { queryExecutor } from './queryExecutor';
import { dataConverters } from './dataConverters';
import { cacheHelper } from './cacheHelper';

// Re-export types and constants
export interface ColumnInfo {
  name: string;
  type: string;
}

// Define types for summary queries
export interface SummaryOption {
  id: string;
  label: string;
  function: string;
  applicableTypes: string[];
}

export interface GroupByOption {
  column: string;
  enabled: boolean;
}

// Special columns for time calculations
export const specialColumns = [
  { id: 'activity_duration', label: 'Activity Duration (Minutes)', type: 'activity' }
];

// List of supported summary functions
export const summaryOptions: SummaryOption[] = [
  { id: 'count', label: 'Count (Unique People)', function: 'COUNT', applicableTypes: ['string', 'number'] },
  { id: 'count_rows', label: 'Count (All Rows)', function: 'COUNT_ROWS', applicableTypes: ['string', 'number'] },
  { id: 'count_distinct', label: 'Count Distinct', function: 'COUNT_DISTINCT', applicableTypes: ['string', 'number'] },
  { id: 'avg', label: 'Average', function: 'AVG', applicableTypes: ['number'] },
  { id: 'sum', label: 'Sum', function: 'SUM', applicableTypes: ['number'] },
  { id: 'min', label: 'Minimum', function: 'MIN', applicableTypes: ['number', 'string'] },
  { id: 'max', label: 'Maximum', function: 'MAX', applicableTypes: ['number', 'string'] },
  { id: 'median', label: 'Median', function: 'MEDIAN', applicableTypes: ['number'] },
  { id: 'stddev', label: 'Standard Deviation', function: 'STDDEV', applicableTypes: ['number'] },
  { id: 'time_spent', label: 'Time Spent (Minutes)', function: 'TIME_SPENT', applicableTypes: ['activity'] }
];

// Public API - maintains the existing interface
export const initDuckDB = dbCore.initDuckDB;
export const executeQuery = queryExecutor.executeQuery;
export const tableToCSV = dataConverters.tableToCSV;
export const getColumns = queryExecutor.getColumns;
export const getPreview = queryExecutor.getPreview;
export const executeSummaryQuery = queryExecutor.executeSummaryQuery;
export const calculateTimeSpentByDemographic = queryExecutor.calculateTimeSpentByDemographic;
export const executeDirectParquetQuery = queryExecutor.executeDirectParquetQuery;
export const onFullDatasetReady = dbCore.onFullDatasetReady;
export const isFullDatasetLoaded = dbCore.isFullDatasetLoaded;
export const clearCache = cacheHelper.clearCache;
export const setDatasetVersion = cacheHelper.setDatasetVersion;
export const getDatasetVersion = cacheHelper.getDatasetVersion; 
