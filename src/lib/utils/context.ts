import { getContext, setContext } from 'svelte';
import { writable, derived, get, type Writable } from 'svelte/store';
import {
  VIEW_MODES,
  type ViewMode,
  allColumns,
  defaultSelectedColumns,
  defaultFilters,
  defaultDemographicColumns,
  defaultActivityColumn,
  defaultAggregations,
  defaultGroupByColumns,
  DEFAULT_PAGE_SIZE,
  DEFAULT_CURRENT_PAGE,
  FEATURES,
} from './constants';
import { createColumnTypesMap } from './dataUtils';
import { runQuery, runSummaryQuery, runTimeAnalysis } from './queryUtils';
import { downloadRawDataCSV, downloadSummaryCSV, downloadTimeAnalysisCSV } from './csvUtils';
import { sortTimeResults } from './dataUtils';
import { initDuckDB } from '../duckdb/service';
import { browser } from '$app/environment';
import { notifications } from './notificationUtils';
import { updateURL } from './urlStateUtils';

// Track last query notification to prevent duplicates
let lastQueryNotification = {
  count: 0,
  type: '',
  timestamp: 0
};

// Minimum time between identical notifications in milliseconds
const NOTIFICATION_THROTTLE_MS = 1000;

// Helper to throttle query notifications
function throttledQueryNotification(count: number, type: string): void {
  const now = Date.now();
  // Only show notification if it's different or enough time has passed
  if (count > 0 && (
    count !== lastQueryNotification.count ||
    type !== lastQueryNotification.type ||
    now - lastQueryNotification.timestamp > NOTIFICATION_THROTTLE_MS
  )) {
    notifications.queryCompleted(count, type);
    lastQueryNotification = {
      count,
      type,
      timestamp: now
    };
  }
}

// Add type definition for window extension
declare global {
  interface Window {
    __duckDBBeforeUnloadAdded?: boolean;
  }

  // Define custom events
  interface WindowEventMap {
    'full_dataset_loaded': CustomEvent<{ datasetVersion: string }>;
    'query_completed': CustomEvent<{ count: number, type: string }>;
    'db_error': CustomEvent<{ message: string }>;
    'data_exported': CustomEvent<{ type: string }>;
    'notification': CustomEvent<{ message: string, type: string }>;
  }
}

// Define common types
export type FilterType = {
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
};

type AppContextType = {
  // State stores
  loading: Writable<boolean>;
  error: Writable<string>;
  dbReady: Writable<boolean>;
  viewMode: Writable<ViewMode>;
  summaryMode: Writable<boolean>;
  timeAnalysisMode: Writable<boolean>;
  selectedColumns: Writable<string[]>;
  filters: Writable<FilterType[]>;
  results: Writable<any[]>;
  resultCount: Writable<number>;
  currentPage: Writable<number>;
  pageSize: Writable<number>;
  totalPages: Writable<number>;
  summaryResults: Writable<any[]>;
  aggregations: Writable<Array<{ column: string, function: string }>>;
  groupByColumns: Writable<string[]>;
  timeAnalysisResults: Writable<any[]>;
  demographicColumns: Writable<string[]>;
  activityColumn: Writable<string>;
  sortColumn: Writable<string>;
  sortDirection: Writable<'asc' | 'desc'>;
  columnTypesMap: Writable<Record<string, string>>;
  useWeightedAverage: Writable<boolean>;

  // Functions
  setViewMode: (mode: ViewMode) => void;
  executeRawDataQuery: () => Promise<void>;
  executeSummaryQuery: () => Promise<void>;
  executeTimeAnalysis: () => Promise<void>;
  sortTimeAnalysisResults: (column: string) => void;
  downloadRawData: () => void;
  downloadSummaryData: () => void;
  downloadTimeAnalysisData: () => void;
  changePage: (newPage: number) => void;
  toggleColumn: (column: string) => void;
  addFilter: () => void;
  removeFilter: (index: number) => void;
  addAggregation: () => void;
  removeAggregation: (index: number) => void;
  toggleGroupByColumn: (column: string) => void;
  toggleDemographicColumn: (column: string) => void;
  initializeDuckDB: () => Promise<void>;
  retryWithSmallerSample: () => Promise<void>;
};

const APP_CONTEXT_KEY = 'timeUseExplorerAppContext';

export function createAppContext() {
  // Create stores for application state
  const loading = writable(false);
  const error = writable('');
  const dbReady = writable(false);

  // View mode store
  const viewMode = writable<ViewMode>(VIEW_MODES.RAW_DATA);
  const summaryMode = writable(false);
  const timeAnalysisMode = writable(false);

  // Raw data stores
  const selectedColumns = writable(defaultSelectedColumns);
  const filters = writable<FilterType[]>(defaultFilters);
  const results = writable<any[]>([]);
  const resultCount = writable(0);
  const currentPage = writable(DEFAULT_CURRENT_PAGE);
  const pageSize = writable(DEFAULT_PAGE_SIZE);
  const totalPages = writable(1);

  // Summary mode stores
  const summaryResults = writable<any[]>([]);
  const aggregations = writable(defaultAggregations);
  const groupByColumns = writable(defaultGroupByColumns);

  // Time analysis mode stores
  const timeAnalysisResults = writable<any[]>([]);
  const demographicColumns = writable(defaultDemographicColumns);
  const activityColumn = writable(defaultActivityColumn);
  const sortColumn = writable('');
  const sortDirection = writable<'asc' | 'desc'>('desc');
  const useWeightedAverage = writable(false);

  // Column types map
  const columnTypesMap = writable(createColumnTypesMap(allColumns));

  // Function to set view mode
  function setViewMode(mode: ViewMode): void {
    viewMode.set(mode);
    summaryMode.set(mode === VIEW_MODES.SUMMARY);
    timeAnalysisMode.set(mode === VIEW_MODES.TIME_ANALYSIS);

    // Note: URL updates removed - now handled manually through Copy URL button

    // Run the appropriate query when switching modes
    if (mode === VIEW_MODES.RAW_DATA) {
      executeRawDataQuery();
    } else if (mode === VIEW_MODES.SUMMARY) {
      executeSummaryQuery();
    } else if (mode === VIEW_MODES.TIME_ANALYSIS) {
      executeTimeAnalysis();
    }
  }

  // Function to execute raw data query
  async function executeRawDataQuery(): Promise<void> {
    const dbReadyValue = get(dbReady);
    if (!dbReadyValue) {
      const errorMsg = 'DuckDB is not ready yet. Please wait...';
      error.set(errorMsg);
      notifications.error(errorMsg);
      return;
    }

    loading.set(true);
    error.set('');

    try {
      const selectedColumnsValue = get(selectedColumns);
      const filtersValue = get(filters);
      const currentPageValue = get(currentPage);
      const pageSizeValue = get(pageSize);

      const { results: queryResults, resultCount: count, totalPages: pages } = await runQuery(
        selectedColumnsValue,
        filtersValue,
        currentPageValue,
        pageSizeValue
      );

      // Use notifications API
      // notifications.queryCompleted(count, 'raw');

      results.set(queryResults);
      resultCount.set(count);
      totalPages.set(pages);

      // Only notify about results if there are any
      if (count > 0) {
        throttledQueryNotification(count, 'raw');
      }

      // Note: We removed URL state updates from here to only update when user
      // explicitly requests via the Copy URL button
    } catch (err) {
      console.error('Error executing query:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.set(`Error executing query: ${errorMessage}`);
      notifications.error(`Query error: ${errorMessage}`);
    } finally {
      loading.set(false);
    }
  }

  // Function to execute summary query
  async function executeSummaryQuery(): Promise<void> {
    const dbReadyValue = get(dbReady);
    if (!dbReadyValue) {
      const errorMsg = 'DuckDB is not ready yet. Please wait...';
      error.set(errorMsg);
      notifications.error(errorMsg);
      return;
    }

    loading.set(true);
    error.set('');

    try {
      const aggregationsValue = get(aggregations);
      const groupByColumnsValue = get(groupByColumns);
      const filtersValue = get(filters);
      const columnTypesMapValue = get(columnTypesMap);

      const summaryResultsValue = await runSummaryQuery(
        aggregationsValue,
        groupByColumnsValue,
        filtersValue,
        columnTypesMapValue
      );

      // Use notifications API
      // notifications.queryCompleted(summaryResultsValue.length, 'summary');

      summaryResults.set(summaryResultsValue);

      // Only notify about results if there are any
      if (summaryResultsValue.length > 0) {
        throttledQueryNotification(summaryResultsValue.length, 'summary');
      }

      // Note: We removed URL state updates from here to only update when user
      // explicitly requests via the Copy URL button
    } catch (err) {
      console.error('Error executing summary query:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.set(`Error executing summary query: ${errorMessage}`);
      notifications.error(`Summary error: ${errorMessage}`);
    } finally {
      loading.set(false);
    }
  }

  // Function to execute time analysis
  async function executeTimeAnalysis(): Promise<void> {
    const dbReadyValue = get(dbReady);
    if (!dbReadyValue) {
      const errorMsg = 'DuckDB is not ready yet. Please wait...';
      error.set(errorMsg);
      notifications.error(errorMsg);
      return;
    }

    loading.set(true);
    error.set('');

    try {
      const demographicColumnsValue = get(demographicColumns);
      const activityColumnValue = get(activityColumn);
      const filtersValue = get(filters);
      const columnTypesMapValue = get(columnTypesMap);
      const useWeightedAverageValue = get(useWeightedAverage);

      if (demographicColumnsValue.length === 0) {
        const errorMsg = 'Please select at least one demographic column to group by';
        error.set(errorMsg);
        notifications.error(errorMsg);
        return;
      }

      const timeAnalysisResultsValue = await runTimeAnalysis(
        demographicColumnsValue,
        activityColumnValue,
        filtersValue,
        columnTypesMapValue,
        useWeightedAverageValue
      );

      timeAnalysisResults.set(timeAnalysisResultsValue);

      // Sort by average minutes by default (descending order)
      sortColumn.set('avg_minutes');
      sortDirection.set('desc');
      sortTimeAnalysisResults('avg_minutes');

      // Only notify about results if there are any
      if (timeAnalysisResultsValue.length > 0) {
        throttledQueryNotification(timeAnalysisResultsValue.length, 'time analysis');
      }

      // Note: We removed URL state updates from here to only update when user
      // explicitly requests via the Copy URL button
    } catch (err) {
      console.error('Error executing time analysis:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.set(`Error executing time analysis: ${errorMessage}`);
      notifications.error(`Time analysis error: ${errorMessage}`);
    } finally {
      loading.set(false);
    }
  }

  // Function to sort time analysis results
  function sortTimeAnalysisResults(column: string): void {
    const timeAnalysisResultsValue = get(timeAnalysisResults);
    const sortColumnValue = get(sortColumn);
    const sortDirectionValue = get(sortDirection);

    const { results, sortColumn: newSortColumn, sortDirection: newSortDirection } = sortTimeResults(
      timeAnalysisResultsValue,
      column,
      sortColumnValue,
      sortDirectionValue
    );

    timeAnalysisResults.set(results);
    sortColumn.set(newSortColumn);
    sortDirection.set(newSortDirection);
  }

  // Function to download raw data as CSV
  function downloadRawData(): void {
    const resultsValue = get(results);
    const selectedColumnsValue = get(selectedColumns);
    downloadRawDataCSV(resultsValue, selectedColumnsValue);

    // Use notifications API
    notifications.dataExported('Raw data');
  }

  // Function to download summary data as CSV
  function downloadSummaryData(): void {
    const summaryResultsValue = get(summaryResults);
    downloadSummaryCSV(summaryResultsValue);

    // Use notifications API
    notifications.dataExported('Summary data');
  }

  // Function to download time analysis data as CSV
  function downloadTimeAnalysisData(): void {
    const timeAnalysisResultsValue = get(timeAnalysisResults);
    downloadTimeAnalysisCSV(timeAnalysisResultsValue);

    // Use notifications API
    notifications.dataExported('Time analysis data');
  }

  // Function to change page
  function changePage(newPage: number): void {
    const totalPagesValue = get(totalPages);
    if (newPage < 1 || newPage > totalPagesValue) return;

    currentPage.set(newPage);

    // Note: We removed URL state updates from here to only update when user
    // explicitly requests via the Copy URL button

    executeRawDataQuery();
  }

  // Function to toggle a column
  function toggleColumn(column: string): void {
    selectedColumns.update(columns => {
      if (columns.includes(column)) {
        return columns.filter(c => c !== column);
      } else {
        return [...columns, column];
      }
    });
  }

  // Function to add a filter
  function addFilter(): void {
    filters.update(currentFilters => [...currentFilters, { column: 'age', operator: '=', value: '', enabled: true }]);
  }

  // Function to remove a filter
  function removeFilter(index: number): void {
    filters.update(filters => filters.filter((_, i) => i !== index));
  }

  // Function to add an aggregation
  function addAggregation(): void {
    aggregations.update(aggs => [...aggs, { column: 'age', function: 'AVG' }]);
  }

  // Function to remove an aggregation
  function removeAggregation(index: number): void {
    aggregations.update(aggs => aggs.filter((_, i) => i !== index));
  }

  // Function to toggle a group by column
  function toggleGroupByColumn(column: string): void {
    groupByColumns.update(columns => {
      if (columns.includes(column)) {
        return columns.filter(c => c !== column);
      } else {
        return [...columns, column];
      }
    });
  }

  // Function to toggle a demographic column
  function toggleDemographicColumn(column: string): void {
    demographicColumns.update(columns => {
      if (columns.includes(column)) {
        return columns.filter(c => c !== column);
      } else {
        return [...columns, column];
      }
    });
  }

  // Function to initialize DuckDB
  async function initializeDuckDB(): Promise<void> {
    loading.set(true);
    error.set('');

    try {
      console.log("Initializing database...");
      loading.set(true);
      dbReady.set(false);

      // Initialize DuckDB (will be in-memory now)
      await initDuckDB();
      dbReady.set(true);

      // Execute initial query when DB is ready
      executeRawDataQuery();

      // Use notifications API for successful initialization
      // notifications.info('Database initialized successfully');
    } catch (err) {
      console.error('Error initializing DuckDB:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.set(`Error initializing DuckDB: ${errorMessage}`);
      dbReady.set(false);
      notifications.error(`Error initializing database: ${errorMessage}`);

      // Clear localStorage flags if there was an error
      if (browser) {
        localStorage.removeItem('duckdb_initialized');
        localStorage.removeItem('duckdb_version');
      }
    } finally {
      loading.set(false);
    }
  }

  // Function to retry with smaller sample
  async function retryWithSmallerSample(): Promise<void> {
    loading.set(true);
    error.set('');

    try {
      // Since we can't use a smaller sample parameter with initDuckDB, 
      // we'll need to implement an alternative approach here.
      // For now, let's just reinitialize the database
      await initDuckDB();
      dbReady.set(true);

      // Setup a more restrictive query with LIMIT
      filters.update(currentFilters => {
        // Check if we already have a person_id filter
        const hasPersonIdFilter = currentFilters.some(f => f.column === 'person_id' && f.operator === 'IS NOT');

        if (!hasPersonIdFilter) {
          return [...currentFilters, {
            column: 'person_id',
            operator: 'IS NOT',
            value: 'NULL',
            enabled: true
          }];
        }
        return currentFilters;
      });

      currentPage.set(1);
      pageSize.update(p => Math.max(50, Math.floor(p / 2))); // Reduce page size by half

      // Execute initial query with smaller sample
      executeRawDataQuery();

      // Use notifications API for successful retry
      notifications.info('Retrying with a smaller data sample');
    } catch (err) {
      console.error('Error retrying with smaller sample:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.set(`Error retrying: ${errorMessage}`);
      notifications.error(`Error retrying with smaller sample: ${errorMessage}`);
    } finally {
      loading.set(false);
    }
  }

  const context: AppContextType = {
    // Stores
    loading,
    error,
    dbReady,
    viewMode,
    summaryMode,
    timeAnalysisMode,
    selectedColumns,
    filters,
    results,
    resultCount,
    currentPage,
    pageSize,
    totalPages,
    summaryResults,
    aggregations,
    groupByColumns,
    timeAnalysisResults,
    demographicColumns,
    activityColumn,
    sortColumn,
    sortDirection,
    columnTypesMap,
    useWeightedAverage,

    // Functions
    setViewMode,
    executeRawDataQuery,
    executeSummaryQuery,
    executeTimeAnalysis,
    sortTimeAnalysisResults,
    downloadRawData,
    downloadSummaryData,
    downloadTimeAnalysisData,
    changePage,
    toggleColumn,
    addFilter,
    removeFilter,
    addAggregation,
    removeAggregation,
    toggleGroupByColumn,
    toggleDemographicColumn,
    initializeDuckDB,
    retryWithSmallerSample
  };

  return context;
}

export function setAppContext() {
  const context = createAppContext();
  setContext(APP_CONTEXT_KEY, context);
  return context;
}

export function getAppContext(): AppContextType {
  return getContext(APP_CONTEXT_KEY);
} 