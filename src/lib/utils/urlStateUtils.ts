import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import type { ViewMode } from './constants';
import type { FilterType } from './context';

/**
 * Serializes the application state to be used in the URL
 */
export function serializeStateToURL(state: {
  viewMode: ViewMode,
  filters?: FilterType[],
  selectedColumns?: string[],
  currentPage?: number,
  demographicColumns?: string[],
  activityColumn?: string,
  aggregations?: Array<{column: string, function: string}>,
  groupByColumns?: string[]
}): string {
  // Create a params object with only active filters
  const params = new URLSearchParams();
  
  // Always add view mode
  params.set('viewMode', state.viewMode);
  
  // Add current page if provided
  if (state.currentPage && state.currentPage > 1) {
    params.set('page', state.currentPage.toString());
  }
  
  // Only add enabled filters with values
  if (state.filters && state.filters.length > 0) {
    const enabledFilters = state.filters
      .filter(f => f.enabled && f.value)
      .map(f => `${f.column}|${f.operator}|${f.value}`);
    
    if (enabledFilters.length > 0) {
      params.set('filters', JSON.stringify(enabledFilters));
    }
  }
  
  // Add column selection if provided
  if (state.selectedColumns && state.selectedColumns.length > 0) {
    params.set('columns', JSON.stringify(state.selectedColumns));
  }
  
  // Add time analysis params if relevant
  if (state.demographicColumns && state.demographicColumns.length > 0) {
    params.set('demographic', JSON.stringify(state.demographicColumns));
  }
  
  if (state.activityColumn) {
    params.set('activity', state.activityColumn);
  }
  
  // Add summary params if relevant
  if (state.aggregations && state.aggregations.length > 0) {
    params.set('agg', JSON.stringify(state.aggregations));
  }
  
  if (state.groupByColumns && state.groupByColumns.length > 0) {
    params.set('groupBy', JSON.stringify(state.groupByColumns));
  }
  
  return params.toString();
}

/**
 * Updates the current URL with the application state without reloading
 */
export function updateURL(state: {
  viewMode: ViewMode,
  filters?: FilterType[],
  selectedColumns?: string[],
  currentPage?: number,
  demographicColumns?: string[],
  activityColumn?: string,
  aggregations?: Array<{column: string, function: string}>,
  groupByColumns?: string[]
}): void {
  if (!browser) return;
  
  const urlParams = serializeStateToURL(state);
  const currentPath = get(page).url.pathname;
  
  // Use the goto function to update the URL without reloading
  goto(`${currentPath}?${urlParams}`, { replaceState: true, noScroll: true });
}

/**
 * Parses filters from URL search params
 */
export function parseFiltersFromURL(params: URLSearchParams): FilterType[] | null {
  try {
    const filtersParam = params.get('filters');
    if (!filtersParam) return null;
    
    const filterStrings = JSON.parse(filtersParam) as string[];
    return filterStrings.map(str => {
      const [column, operator, value] = str.split('|');
      return { column, operator, value, enabled: true };
    });
  } catch (e) {
    console.error('Error parsing filters from URL', e);
    return null;
  }
}

/**
 * Parses selected columns from URL search params
 */
export function parseColumnsFromURL(params: URLSearchParams): string[] | null {
  try {
    const columnsParam = params.get('columns');
    if (!columnsParam) return null;
    
    return JSON.parse(columnsParam) as string[];
  } catch (e) {
    console.error('Error parsing columns from URL', e);
    return null;
  }
}

/**
 * Parses demographic columns from URL search params
 */
export function parseDemographicColumnsFromURL(params: URLSearchParams): string[] | null {
  try {
    const demographicParam = params.get('demographic');
    if (!demographicParam) return null;
    
    return JSON.parse(demographicParam) as string[];
  } catch (e) {
    console.error('Error parsing demographic columns from URL', e);
    return null;
  }
}

/**
 * Parses aggregations from URL search params
 */
export function parseAggregationsFromURL(params: URLSearchParams): Array<{column: string, function: string}> | null {
  try {
    const aggParam = params.get('agg');
    if (!aggParam) return null;
    
    return JSON.parse(aggParam) as Array<{column: string, function: string}>;
  } catch (e) {
    console.error('Error parsing aggregations from URL', e);
    return null;
  }
}

/**
 * Parses group by columns from URL search params
 */
export function parseGroupByColumnsFromURL(params: URLSearchParams): string[] | null {
  try {
    const groupByParam = params.get('groupBy');
    if (!groupByParam) return null;
    
    return JSON.parse(groupByParam) as string[];
  } catch (e) {
    console.error('Error parsing group by columns from URL', e);
    return null;
  }
}

/**
 * Parses the complete application state from URL
 */
export function parseStateFromURL(params: URLSearchParams): {
  viewMode?: ViewMode,
  filters?: FilterType[],
  selectedColumns?: string[],
  currentPage?: number,
  demographicColumns?: string[],
  activityColumn?: string,
  aggregations?: Array<{column: string, function: string}>,
  groupByColumns?: string[]
} {
  const state: any = {};
  
  // Parse view mode
  const viewMode = params.get('viewMode');
  if (viewMode) state.viewMode = viewMode;
  
  // Parse page
  const page = params.get('page');
  if (page && !isNaN(Number(page))) {
    state.currentPage = Number(page);
  }
  
  // Parse other data
  const filters = parseFiltersFromURL(params);
  if (filters) state.filters = filters;
  
  const columns = parseColumnsFromURL(params);
  if (columns) state.selectedColumns = columns;
  
  const demographic = parseDemographicColumnsFromURL(params);
  if (demographic) state.demographicColumns = demographic;
  
  const activity = params.get('activity');
  if (activity) state.activityColumn = activity;
  
  const aggregations = parseAggregationsFromURL(params);
  if (aggregations) state.aggregations = aggregations;
  
  const groupBy = parseGroupByColumnsFromURL(params);
  if (groupBy) state.groupByColumns = groupBy;
  
  return state;
} 