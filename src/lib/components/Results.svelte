<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Database, BarChart, Clock, ChevronDown } from 'lucide-svelte';
  import SortableTable from './SortableTable.svelte';
  import Pagination from './Pagination.svelte';
  import ActionButton from './ActionButton.svelte';
  import LoadingGame from './LoadingGame.svelte';
  import VisualizationPanel from './VisualizationPanel.svelte';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { getAppContext } from '$lib/utils/context';
  import { VIEW_MODES, allColumns, FEATURES } from '$lib/utils/constants';
  import { notifications } from '$lib/utils/notificationUtils';
  import { page } from '$app/stores';
  
  // Get the app context directly
  const {
    loading,
    error,
    dbReady,
    viewMode,
    results,
    resultCount,
    currentPage,
    pageSize,
    totalPages,
    summaryResults,
    timeAnalysisResults,
    sortColumn,
    sortDirection,
    filters,
    selectedColumns,
    demographicColumns,
    activityColumn,
    aggregations, 
    groupByColumns,
    
    downloadRawData,
    downloadSummaryData,
    downloadTimeAnalysisData,
    changePage,
    sortTimeAnalysisResults,
  } = getAppContext();
  
  $: summaryMode = $viewMode === VIEW_MODES.SUMMARY;
  $: timeAnalysisMode = $viewMode === VIEW_MODES.TIME_ANALYSIS;
  $: rawDataMode = $viewMode === VIEW_MODES.RAW_DATA;
  
  let usingCachedData = false;
  let loadingFromUrl = false;
  
  // Check if we're loading from a URL
  $: loadingMessage = loadingFromUrl 
    ? 'Executing query from URL...' 
    : (usingCachedData 
      ? 'Loading from cache...' 
      : 'Loading data...');
  
  // Update loading message based on cache state
  $: baseLoadingMessage = usingCachedData 
    ? 'Loading from cache...' 
    : ($dbReady ? 'Loading results...' : 'Initializing database... This may take a moment');
    
  // Get results message based on view mode
  $: resultsMessage = $loading 
    ? loadingMessage 
    : (!currentResults.length)
      ? ($dbReady ? 'No results found. Try adjusting your filters or aggregations.' : 'Initializing database...')
      : (timeAnalysisMode)
        ? `Showing time analysis results`
        : (summaryMode)
          ? `Showing ${formatNumber($summaryResults.length, { type: 'standard', decimals: 0 })} summary rows. `
          : `Showing ${formatNumber(($currentPage - 1) * $pageSize + 1, { type: 'standard', decimals: 0 })}-${formatNumber(Math.min($currentPage * $pageSize, $resultCount), { type: 'standard', decimals: 0 })} of ${formatNumber($resultCount, { type: 'standard', decimals: 0 })} matching rows. `;
            
  // Add handlers for data events
  function onCachedDataLoaded(event: Event) {
    usingCachedData = true;
    setTimeout(() => {
      usingCachedData = false;
    }, 2000); // Reset after 2 seconds
  }

  function onUrlQueryDetected(event: Event) {
    loadingFromUrl = true;
  }
  
  function onUrlQueryCompleted(event: Event) {
    loadingFromUrl = false;
  }
  
  // Subscribe to custom events
  onMount(() => {
    if (browser) {
      window.addEventListener('cached_data_loaded', onCachedDataLoaded);
      window.addEventListener('url_query_processing', onUrlQueryDetected);
      window.addEventListener('url_query_completed', onUrlQueryCompleted);
      
      // Check if URL has query parameters on load
      if (FEATURES.ENABLE_URL_STATE && $page.url.searchParams.has('viewMode')) {
        loadingFromUrl = true;
      }
      
      return () => {
        window.removeEventListener('cached_data_loaded', onCachedDataLoaded);
        window.removeEventListener('url_query_processing', onUrlQueryDetected);
        window.removeEventListener('url_query_completed', onUrlQueryCompleted);
      };
    }
  });
  
  // Column type definition
  type ColumnFormatType = 'standard' | 'lakhs' | 'millions' | 'billions' | 'compact' | 'percentage' ;
  type ColumnDefinition = {
    id: string;
    label: string;
    sortable?: boolean;
    formatType?: ColumnFormatType;
    formatOptions?: {
      decimals?: number;
      prefix?: string;
      suffix?: string;
    };
  };
  
  // Helper functions for DRY code
  function getColumnLabel(columnId: string): string {
    return allColumns.find(c => c.id === columnId)?.label || columnId;
  }
  
  function createColumnDefinition(columnId: string, sortable = true): ColumnDefinition {
    // Get column type from allColumns
    const columnInfo = allColumns.find(c => c.id === columnId);
    const isNumeric = columnInfo?.type === 'number';
    
    // Special formatting for specific columns
    let formatType: ColumnFormatType | undefined;
    let formatOptions: { decimals?: number; prefix?: string; suffix?: string } | undefined;
    
    // Format settings based on column and context
    if (isNumeric || columnId.includes('count') || columnId.includes('avg') || columnId.includes('sum') || columnId.includes('min') || columnId.includes('max')) {
      if (columnId.includes('count') || columnId === 'activity_count') {
        formatType = 'standard';
        formatOptions = { decimals: 0 };
      } else if (columnId.includes('avg') || columnId.includes('minutes')) {
        formatType = 'standard';
        formatOptions = { decimals: 1 };
      } else if (columnId.includes('sum')) {
        formatType = 'standard';
        formatOptions = { decimals: 1 };
      } else if (columnId === 'age' || columnId === 'household_size') {
        formatType = 'standard';
        formatOptions = { decimals: 0 };
      }
    }
    
    return {
      id: columnId,
      label: getColumnLabel(columnId),
      sortable,
      formatType,
      formatOptions
    };
  }
  
  // Get download action, icon and determine if results exist based on view mode
  $: downloadAction = timeAnalysisMode 
    ? downloadTimeAnalysisData 
    : (summaryMode ? downloadSummaryData : downloadRawData);
  
  $: resultsExist = timeAnalysisMode 
    ? $timeAnalysisResults.length > 0
    : (summaryMode ? $summaryResults.length > 0 : $results.length > 0);
  
  // Helper function to format time values with proper suffixes
  function formatTimeValue(value: number, useCompact: boolean = false): string {
    if (useCompact) {
      // First format the number with compact notation
      const formatted = formatNumber(value, {
        type: 'compact',
        decimals: 1
      });
      // Then add 'min' between the number and the unit suffix
      return formatted.replace(/([0-9.]+)([KLM])?$/, '$1 min $2').trim();
    } else {
      return formatNumber(value, {
        type: 'standard',
        decimals: 1,
        suffix: ' min'
      });
    }
  }
  
  // Get current results based on view mode
  $: currentResults = timeAnalysisMode 
    ? $timeAnalysisResults.map(result => ({
        ...result,
        // Format total_minutes with both time and unit suffixes
        total_minutes: formatTimeValue(result.total_minutes, true)
      }))
    : (summaryMode ? $summaryResults : $results);
    
  // Get columns based on the actual data structure in results
  $: currentColumns = currentResults.length > 0
    ? Object.keys(currentResults[0]).map(key => createColumnDefinition(key))
    : [];
    
  // Get empty message based on view mode
  $: emptyMessage = timeAnalysisMode
    ? 'No time analysis results to display. Try adjusting your filters.'
    : (summaryMode 
      ? 'No summary results to display. Try adjusting your filters and aggregations.'
      : 'No results to display. Adjust your filters and run the query.');
      
  // Get header icon and title based on view mode
  $: headerIcon = timeAnalysisMode 
    ? Clock 
    : (summaryMode ? BarChart : Database);
    
  $: headerTitle = timeAnalysisMode 
    ? 'Time Analysis' 
    : (summaryMode ? 'Summary' : 'Raw Data');
    
  // Game state
  let showGame = true;
  let showGameComponent = true;
  
  // Load user preference from localStorage
  onMount(() => {
    if (browser) {
      const hideGamePermanently = localStorage.getItem('hideLoadingGame') === 'true';
      if (hideGamePermanently) {
        showGame = false;
        showGameComponent = false;
      }
    }
  });
  
  function hideGamePermanently() {
    if (browser) {
      localStorage.setItem('hideLoadingGame', 'true');
      showGame = false;
      showGameComponent = false;
    }
  }
  
  function showLoadingSpinner() {
    showGame = false;
  }
</script>

<!-- Results panel -->
<div class="flex flex-col h-full">
  <!-- Mobile visualization - only shown on small screens -->
   {#if $viewMode !== VIEW_MODES.RAW_DATA}
  <details class="block lg:hidden mb-2 bg-base-100 border border-neutral group">
    <summary class="p-3 font-semibold text-xs cursor-pointer border-b bg-base-200 border-neutral/20 flex items-center justify-between [&::-webkit-details-marker]:hidden">
      Visualization
      <ChevronDown class="w-3 h-3 transition-transform duration-200 group-open:rotate-180" />
    </summary>
    <div class="p-0">
      <VisualizationPanel />
    </div>
  </details>
  {/if}
  
  <!-- Desktop visualization is handled elsewhere in the layout -->
  
  <div class="bg-base-100 border border-neutral flex flex-col">
    <!-- Results Header -->
    <div class="p-2 flex justify-between items-start border-b border-neutral bg-base-200">
      <div class="flex flex-col gap-1">
        <h2 class="text-xs uppercase font-bold text-neutral flex items-center gap-1">
          <svelte:component this={headerIcon} class="w-3 h-3" />
          <span>{headerTitle}</span>
        </h2>
        <p class="text-xs text-base-300" style="font-family: var(--font-ui);">
          {resultsMessage}
        </p>
      </div>
      <div>
        <div class="flex gap-1">
          <ActionButton
            onClick={downloadAction}
            loading={$loading}
            disabled={!resultsExist || $loading}
            icon="download"
            label="Download CSV"
            variant="secondary"
          />
          
          {#if resultsExist && FEATURES.ENABLE_URL_STATE}
            <ActionButton
              onClick={() => {
                import('$lib/utils/urlStateUtils').then(module => {
                  const { serializeStateToURL } = module;
                  
                  // Get current state from context
                  const currentState = {
                    viewMode: $viewMode,
                    filters: $filters || [],
                    selectedColumns: $selectedColumns || [],
                    currentPage: $currentPage,
                    demographicColumns: $demographicColumns || [],
                    activityColumn: $activityColumn,
                    aggregations: $aggregations || [],
                    groupByColumns: $groupByColumns || []
                  };
                  
                  // Create URL with state
                  const urlParams = serializeStateToURL(currentState);
                  const url = `${window.location.origin}${window.location.pathname}?${urlParams}`;
                  
                  // Copy to clipboard
                  navigator.clipboard.writeText(url)
                    .then(() => {
                      notifications.success('URL to this data view copied to clipboard');
                    })
                    .catch(err => {
                      console.error('Failed to copy URL:', err);
                      notifications.error('Failed to copy URL');
                    });
                });
              }}
              icon="link"
              label="Share"
              variant="secondary"
            />
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Results Content -->
    <div class="overflow-auto">
      {#if showGameComponent}
        <LoadingGame 
          loading={$loading} 
          dbReady={$dbReady} 
          show={showGame}
          on:hideGame={() => showGame = false}
          on:hideGamePermanently={hideGamePermanently}
          on:showLoadingSpinner={showLoadingSpinner}
        />
      {/if}

      <div class:hidden={showGame && showGameComponent}>
        <SortableTable 
          columns={currentColumns}
          rows={currentResults}
          loading={$loading}
          loadingMessage={loadingMessage}
          emptyMessage={emptyMessage}
          sortColumn={$sortColumn}
          sortDirection={$sortDirection}
          onSort={sortTimeAnalysisResults}
          fadeInRows={rawDataMode}
          showStripes={rawDataMode}
          useInternalSort={true}
        />
        
        {#if rawDataMode}
          <Pagination currentPage={$currentPage} totalPages={$totalPages} loading={$loading} changePage={changePage} />
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- <style>
  /* Custom style for details element */
  details {
    overflow: hidden;
    transition: max-height 0.3s ease-out;
  }

  details[open] summary {
    border-bottom: 1px solid #f0f0f0;
  }

  /* Custom marker styling */
  summary {
    list-style: none;
    position: relative;
  }
  
  summary::-webkit-details-marker {
    display: none;
  }
  
  summary::after {
    content: '';
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%) rotate(0);
    width: 0.75rem;
    height: 0.75rem;
    border-bottom: 2px solid #888;
    border-right: 2px solid #888;
    transform-origin: center;
    transition: transform 0.2s ease;
    transform: translateY(-50%) rotate(45deg);
  }
  
  details[open] summary::after {
    transform: translateY(-50%) rotate(-135deg);
  }
  
  /* Hover effect */
  summary:hover {
    background-color: #f5f5f5;
  }
</style>  -->