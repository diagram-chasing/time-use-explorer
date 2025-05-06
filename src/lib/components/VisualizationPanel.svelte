<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import { getAppContext } from '$lib/utils/context';
  import { VIEW_MODES } from '$lib/utils/constants';
  import { 
    Settings, BarChart as BarChartIcon, BarChartHorizontal, Map as MapIcon, Grid
  } from 'lucide-svelte';
  import { slide, fade } from 'svelte/transition';
  
  // Import chart components
  import BarChartComponent from './charts/BarChart.svelte';
  import MapChartComponent from './charts/MapChart.svelte';
  import HeatmapChartComponent from './charts/HeatmapChart.svelte';
  import DataTooltip from './charts/DataTooltip.svelte';

  const {
    loading,
    viewMode,
    results,
    summaryResults,
    timeAnalysisResults,
  } = getAppContext();

  $: summaryMode = $viewMode === VIEW_MODES.SUMMARY;
  $: timeAnalysisMode = $viewMode === VIEW_MODES.TIME_ANALYSIS;
  
  $: resultsExist = timeAnalysisMode 
    ? $timeAnalysisResults.length > 0
    : (summaryMode ? $summaryResults.length > 0 : $results.length > 0);
  
  // Determine when visualizations should be shown
  $: shouldShow = ($viewMode === VIEW_MODES.SUMMARY || $viewMode === VIEW_MODES.TIME_ANALYSIS) && 
                 (($summaryResults.length > 0 || $timeAnalysisResults.length > 0));
  
  // Ensure active chart is set correctly based on viewMode
  $: {
    if ($viewMode === VIEW_MODES.TIME_ANALYSIS) {
      activeChart = 'heatmap';
    } else if ($viewMode === VIEW_MODES.SUMMARY && activeChart === 'heatmap') {
      activeChart = 'bar';
    }
  }

  type ChartType = 'bar' | 'map' | 'heatmap' | 'histogram';
  

  let advancedMode = false;
  let activeChart: ChartType = 'bar';
  let topNValue = 10; 
  let histogramBins = 10;
  
  // Selected columns for visualizations
  let selectedMapValue: string | null = null;
  let selectedXColumn: string | null = null;
  let selectedYColumn: string | null = null;
  let selectedHeatmapRow: string | null = null;
  let selectedHeatmapColumn: string | null = null;
  let selectedHeatmapValue: string | null = null;
  
  // Tooltip state
  let showTooltip = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let tooltipRows: {label: string; value: string; highlight?: boolean}[] = [];
  let tooltipTheme: 'light' | 'dark' = 'light';

  let svgWidth = 0;
  let svgHeight = 0;
  let margin = { top: 0, right: 5, bottom: 0, left: 15 };
  
  // Compute the effective margin based on chart type
  $: effectiveMargin = {
    ...margin,
    left:
          activeChart === 'heatmap' ? 70 :
          margin.left,
    top: activeChart === 'heatmap' ? 70 : margin.top,
    bottom: activeChart === 'bar' ? 40 : activeChart === 'heatmap' ? 10 : margin.bottom
  };
  
  // Element references
  let vizContainer: HTMLDivElement;
  
  // Map data and loading state
  let mapGeoData: any = null;
  let isLoadingGeoData = false;
  let mapError = '';

  // Define all possible chart options
  const allChartOptions = [
    {
      label: 'Bar',
      value: 'bar'
    },
    // {
    //   label: 'Map',
    //   value: 'map'
    // },
    {
      label: 'Heatmap',
      value: 'heatmap'
    }
  ];
  
  // Filter chart options based on view mode
  $: chartOptions = $viewMode === VIEW_MODES.TIME_ANALYSIS 
    ? allChartOptions.filter(option => option.value === 'heatmap')
    : allChartOptions.filter(option => option.value !== 'heatmap');
  
  // Get the current dataset based on view mode
  $: currentData = $viewMode === VIEW_MODES.SUMMARY ? $summaryResults : $timeAnalysisResults;
  
  // Extract available columns by type
  $: categoricalColumns = currentData && currentData.length > 0 
    ? Object.keys(currentData[0])
        .filter(key => 
          // Include string columns
          typeof currentData[0][key] === 'string' ||
          // Also include common numeric columns that are likely categorical
          ['household_size', 'age', 'age_group', 'activity_code'].includes(key) ||
          // Include columns with small integer values (likely categorical)
          (typeof currentData[0][key] === 'number' && 
           [...new Set(currentData.map(d => d[key]))].length < 30)
        )
        .map(key => ({ id: key, label: formatColumnLabel(key) }))
    : [];
    
  $: numericColumns = currentData && currentData.length > 0 
    ? Object.keys(currentData[0])
        .filter(key => typeof currentData[0][key] === 'number' || 
                (typeof currentData[0][key] === 'string' && !isNaN(parseFloat(currentData[0][key]))))
        .map(key => ({ id: key, label: formatColumnLabel(key) }))
    : [];
    
  // All columns (for when we want to treat numeric columns as categorical)
  $: allColumns = currentData && currentData.length > 0
    ? Object.keys(currentData[0])
        .map(key => ({ id: key, label: formatColumnLabel(key) }))
    : [];
  
  // Make the reactive statement also depend on viewMode to reset selections when mode changes
  $: if (currentData && currentData.length > 0 && $viewMode) {
    // Reset selections when view mode changes
    if (selectedXColumn === null || 
        (categoricalColumns.length > 0 && !categoricalColumns.some(c => c.id === selectedXColumn))) {
      // Prefer original categorical variables over aggregated ones
      const preferredX = categoricalColumns.find(c => 
        // First prioritize demographic columns that aren't prefixed with aggregation functions
        !c.id.startsWith('count_') && 
        !c.id.startsWith('avg_') && 
        !c.id.startsWith('sum_') && 
        ['state', 'district', 'gender', 'age_group', 'religion', 'social_group', 'activity_code'].includes(c.id)
      );
      selectedXColumn = preferredX ? preferredX.id : (categoricalColumns.length > 0 ? categoricalColumns[0].id : null);
    }
    
    if (selectedYColumn === null || 
        (numericColumns.length > 0 && !numericColumns.some(c => c.id === selectedYColumn))) {
      // For time analysis, prefer time-related columns
      if ($viewMode === VIEW_MODES.TIME_ANALYSIS) {
        const timeColumn = numericColumns.find(c => 
          c.id.includes('minutes') || c.id.includes('time')
        );
        selectedYColumn = timeColumn ? timeColumn.id : (numericColumns.length > 0 ? numericColumns[0].id : null);
      } else {
        // For summary, prefer count columns
        const countColumn = numericColumns.find(c => 
          c.id.includes('count')
        );
        selectedYColumn = countColumn ? countColumn.id : (numericColumns.length > 0 ? numericColumns[0].id : null);
      }
    }
    
    if (selectedMapValue === null || 
        (numericColumns.length > 0 && !numericColumns.some(c => c.id === selectedMapValue))) {
      selectedMapValue = selectedYColumn; // Use same as chart by default
    }
    
    // Set default heatmap columns
    if (selectedHeatmapRow === null || 
        (categoricalColumns.length > 0 && !categoricalColumns.some(c => c.id === selectedHeatmapRow))) {
      // For religion, social group, etc.
      const religionColumn = categoricalColumns.find(c => c.id.includes('religion'));
      selectedHeatmapRow = religionColumn ? religionColumn.id : (categoricalColumns.length > 0 ? categoricalColumns[0].id : null);
    }
    
    if (selectedHeatmapColumn === null || 
        (categoricalColumns.length > 0 && !categoricalColumns.some(c => c.id === selectedHeatmapColumn))) {
      // For activity code, social group, etc.
      const activityColumn = categoricalColumns.find(c => 
        c.id.includes('activity') || c.id.includes('social')
      );
      // Make sure we don't use the same column for row and column
      const availableColumns = categoricalColumns.filter(c => c.id !== selectedHeatmapRow);
      selectedHeatmapColumn = activityColumn && activityColumn.id !== selectedHeatmapRow 
        ? activityColumn.id 
        : (availableColumns.length > 0 ? availableColumns[0].id : (categoricalColumns.length > 1 ? categoricalColumns[1].id : selectedHeatmapRow));
    }
    
    if (selectedHeatmapValue === null || 
        (numericColumns.length > 0 && !numericColumns.some(c => c.id === selectedHeatmapValue))) {
      // Prefer average time for heatmap
      const avgTimeColumn = numericColumns.find(c => 
        c.id.includes('avg') && (c.id.includes('minute') || c.id.includes('time'))
      );
      selectedHeatmapValue = avgTimeColumn ? avgTimeColumn.id : (numericColumns.length > 0 ? numericColumns[0].id : null);
    }
  }
  
  // Format column labels for display
  function formatColumnLabel(column: string): string {
    return column
      .replace(/_/g, ' ')
      .replace(/^(count|avg|sum|min|max)_/, '$1 ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Process bar chart data using D3
  $: if (currentData && currentData.length > 0 && selectedXColumn && activeChart === 'bar' && vizContainer) {
    // Get dimensions
    svgWidth = vizContainer.clientWidth;
    svgHeight = vizContainer.clientHeight - 52; // Account for legend
    
    // For time analysis, we always want to show total time or count (not averages)
    // Find appropriate columns for the visualization
    let valueColumn = null;
    // First try to find total time
    if (currentData[0].hasOwnProperty('total_time') || currentData[0].hasOwnProperty('total_minutes')) {
      valueColumn = currentData[0].hasOwnProperty('total_time') ? 'total_time' : 'total_minutes';
    } 
    // If no total time, use count
    else if (currentData[0].hasOwnProperty('count')) {
      valueColumn = 'count';
    }
    // Last resort, use first numeric column
    else {
      valueColumn = numericColumns.length > 0 ? numericColumns[0].id : null;
    }
    
    // Only proceed if we have a value column
    if (valueColumn) {
      // Save selected value column for UI
      selectedYColumn = valueColumn;
    }
  }
  

  
  // Process map data
  $: if (currentData && currentData.length > 0 && selectedMapValue && activeChart === 'map') {
    // Determine geographic column (state or district)
    const geoColumn = currentData[0].hasOwnProperty('state') ? 'state' : 
                    (currentData[0].hasOwnProperty('district') ? 'district' : null);
    
    if (geoColumn) {
      // Load GeoJSON if not already loaded
      if (!mapGeoData && !isLoadingGeoData) {
        loadMapData();
      }
    }
  }
  
  // Process heatmap data
  $: if (currentData && currentData.length > 0 && selectedHeatmapRow && selectedHeatmapColumn && selectedHeatmapValue && activeChart === 'heatmap' && vizContainer) {
    // Get dimensions
    svgWidth = vizContainer.clientWidth;
    svgHeight = vizContainer.clientHeight; // Account for legend
  }
  
  // Load India GeoJSON data
  async function loadMapData() {
    isLoadingGeoData = true;
    mapError = '';
    
    try {
      // Simplified India state boundaries - this would be a real API call or file load in production
      const mockIndiaStates = [
        { name: "Andhra Pradesh", id: "AP" },
        { name: "Tamil Nadu", id: "TN" },
        { name: "Maharashtra", id: "MH" },
        { name: "Karnataka", id: "KA" },
        { name: "Kerala", id: "KL" },
        { name: "Gujarat", id: "GJ" },
        { name: "Rajasthan", id: "RJ" },
        { name: "Madhya Pradesh", id: "MP" },
        { name: "Uttar Pradesh", id: "UP" },
        { name: "Bihar", id: "BR" },
        { name: "West Bengal", id: "WB" },
        { name: "Delhi", id: "DL" },
        { name: "Punjab", id: "PB" },
        { name: "Haryana", id: "HR" },
        { name: "Telangana", id: "TG" }
      ];
      
      // Create a simple map data structure
      mapGeoData = { 
        type: "FeatureCollection",
        features: mockIndiaStates.map(state => ({
          type: "Feature",
          properties: { name: state.name, id: state.id },
          // Mock geometry for the example
          geometry: { type: "Polygon", coordinates: [[]] }
        }))
      };
      
      // In a real implementation, you would load GeoJSON from a file:
      // const response = await fetch('/data/india_states.geojson');
      // mapGeoData = await response.json();
    } catch (error) {
      console.error('Failed to load map data:', error);
      mapError = 'Failed to load geographic data';
    } finally {
      isLoadingGeoData = false;
    }
  }
  
  // Handle tooltip display
  function showHeatmapTooltip(event: CustomEvent) {
    const { x, y, rows } = event.detail;
    tooltipRows = rows;
    tooltipX = x;
    tooltipY = y;
    showTooltip = true;
  }
  
  function hideTooltip() {
    showTooltip = false;
  }
  
  // Handle click outside to close the panel
  function handleClickOutside(event: MouseEvent) {
    if (advancedMode) {
      const target = event.target as HTMLElement;
      const panel = document.querySelector('.settings-panel');
      const settingsButton = document.querySelector('.settings-button');

      if (panel && !panel.contains(target) && settingsButton && !settingsButton.contains(target)) {
        advancedMode = false;
      }
    }
  }
  
  // Update dimensions
  function updateDimensions() {
    if (vizContainer) {
      svgWidth = vizContainer.clientWidth;
      svgHeight = vizContainer.clientHeight; // Account for legend
    }
  }
  
  // Add click listener when component mounts
  onMount(() => {
    if (vizContainer) {
      updateDimensions();
      
      // Force an initial update after the DOM is fully rendered
      setTimeout(updateDimensions, 100);
    }

    
    // Add resize listener
    window.addEventListener('resize', updateDimensions);
    // Add click listener for outside clicks
    window.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  });

  afterUpdate(() => {
    updateDimensions();
  });

</script>

{#if shouldShow}
  <div class="bg-base-100 border border-neutral h-full max-h-[370px]">
    <div class="p-2 flex flex-col md:h-full relative">
      <div class="flex justify-between w-full items-center mb-1">
        <!-- <h3 class="text-xs font-mono font-semibold">Data Visualization</h3> -->
        
        <div class="flex items-center gap-2">
          {#each chartOptions as option}
            <button 
              class={`tab flex gap-1 items-center ${activeChart === option.value ? 'tab-active bg-neutral text-white' : ' text-neutral hover:border-neutral border border-transparent'} text-[10px] px-2 py-1`}
              on:click={() => activeChart = option.value as ChartType}
            >
              <span>{option.label}</span>
            </button>
          {/each}
        </div>
       
        
        <button 
          class={`settings-button border border-neutral p-0.5 ${advancedMode ? 'bg-neutral text-white' : ' text-neutral hover:bg-neutral hover:text-white'}`}
          on:click={() => advancedMode = !advancedMode}
          title={advancedMode ? 'Hide Settings' : 'Show Settings'}
        >
          <Settings class="w-3 h-3" />
        </button>
      </div>
      
      {#if advancedMode}
        <!-- Backdrop overlay -->
        <div 
          class="backdrop fixed inset-0 z-5"
          transition:fade={{ duration: 150 }}
          on:click={() => advancedMode = false}
        ></div>
        
        <div 
          class="settings-panel absolute right-0 top-0 bottom-0 z-40 bg-white border-l border-neutral p-3 shadow-md min-w-[220px] max-w-[80%] h-[calc(100%)] overflow-y-auto"
          transition:slide={{ duration: 200, axis: 'x' }}
        >
          <div class="h-full overflow-y-auto">
            {#if activeChart === 'bar'}
              <div class="flex flex-col gap-2 text-[9px]">

                <div class="mb-1">
                  <p class="text-base-300 mt-1 mb-2">
                    This visualization automatically shows either total time or activity count 
                    for each {selectedXColumn ? formatColumnLabel(selectedXColumn).toLowerCase() : 'category'}.
                  </p>
                </div>
                <div class="mb-1">
                  <label for="x-column" class="control-label">Group by:</label>
                  <select 
                    id="x-column" 
                    class="control-input w-full"
                    bind:value={selectedXColumn}
                  >
                    <!-- Allow selection of any column (including numeric) as a dimensional/categorical field -->
                    {#each allColumns as column}
                      <option value={column.id}>{column.label}</option>
                    {/each}
                  </select>
                </div>
                
               
                
                <div class="mb-1">
                  <label for="top-n" class="control-label">Show Top:</label>
                  <input 
                    id="top-n"
                    type="number" 
                    min="1" 
                    max="50"
                    class="control-input w-full"
                    bind:value={topNValue}
                  />
                </div>
              </div>
            {:else if activeChart === 'histogram'}
              <div class="flex flex-col gap-2 text-[9px]">
                <div class="mb-1">
                  <label for="hist-column" class="control-label">Value:</label>
                  <select 
                    id="hist-column"
                    class="control-input w-full"
                    bind:value={selectedYColumn}
                  >
                    {#each numericColumns as column}
                      <option value={column.id}>{column.label}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="mb-1">
                  <label for="hist-bins" class="control-label">Number of Bins:</label>
                  <input 
                    id="hist-bins"
                    type="number" 
                    min="5" 
                    max="50"
                    class="control-input w-full"
                    bind:value={histogramBins}
                  />
                </div>
              </div>
            {:else if activeChart === 'map' && currentData.length > 0}
              <div class="flex flex-col gap-2 text-[9px]">
                <div class="mb-1">
                  <label for="map-value" class="control-label">Value:</label>
                  <select 
                    id="map-value"
                    class="control-input w-full"
                    bind:value={selectedMapValue}
                  >
                    {#each numericColumns as column}
                      <option value={column.id}>{column.label}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {:else if activeChart === 'heatmap'}
              <div class="flex flex-col gap-2 text-[9px]">
                <div class="mb-1 mt-2">
                  <p class="text-base-300">
                    Map two categorical columns against each other, with color intensity representing the value.
                  </p>
                </div>
                <div class="mb-1">
                  <label for="heatmap-row" class="control-label">Rows:</label>
                  <select 
                    id="heatmap-row"
                    class="control-input w-full"
                    bind:value={selectedHeatmapRow}
                  >
                    {#each allColumns as column}
                      <option value={column.id}>{column.label}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="mb-1">
                  <label for="heatmap-column" class="control-label">Columns:</label>
                  <select 
                    id="heatmap-column"
                    class="control-input w-full"
                    bind:value={selectedHeatmapColumn}
                  >
                    {#each allColumns.filter(c => c.id !== selectedHeatmapRow) as column}
                      <option value={column.id}>{column.label}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="mb-1">
                  <label for="heatmap-value" class="control-label">Value:</label>
                  <select 
                    id="heatmap-value"
                    class="control-input w-full"
                    bind:value={selectedHeatmapValue}
                  >
                    {#each numericColumns as column}
                      <option value={column.id}>{column.label}</option>
                    {/each}
                  </select>
                </div>
                
               
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <div class="viz-container flex-grow h-full relative" bind:this={vizContainer}>
        {#if activeChart === 'bar' && currentData.length > 0 && selectedXColumn !== null && selectedYColumn !== null && !(currentData.length === 1 && 'count_all' in currentData[0])}
          <BarChartComponent 
            rawData={currentData}
            xColumnField={selectedXColumn}
            yColumnField={selectedYColumn}
            topN={topNValue}
            svgWidth={svgWidth} 
            svgHeight={svgHeight} 
            margin={effectiveMargin}
          />
        {:else if activeChart === 'map' && currentData.length > 0 && selectedMapValue !== null}
          <MapChartComponent 
            rawData={currentData}
            valueField={selectedMapValue}
            mapGeoData={mapGeoData}
            isLoadingGeoData={isLoadingGeoData}
            mapError={mapError}
          />
        {:else if activeChart === 'heatmap' && currentData.length > 0 && selectedHeatmapRow !== null && selectedHeatmapColumn !== null && selectedHeatmapValue !== null}
          <HeatmapChartComponent 
            rawData={currentData}
            rowField={selectedHeatmapRow}
            columnField={selectedHeatmapColumn}
            valueField={selectedHeatmapValue}
            svgWidth={svgWidth} 
            svgHeight={svgHeight} 
            margin={effectiveMargin}
            on:showTooltip={showHeatmapTooltip}
            on:hideTooltip={hideTooltip}
          />
        {:else if $loading}
          <div class="flex justify-center items-center h-full text-base-300">
            <p class="text-[10px]">Loading visualization data...</p>
          </div>
        {:else}
          <div class="flex justify-center items-center h-full text-base-300">
            <p class="text-[10px]">Select data to visualize</p>
          </div>
        {/if}
        
        <!-- Use the DataTooltip component -->
        <DataTooltip 
          visible={showTooltip}
          x={tooltipX}
          y={tooltipY}
          rows={tooltipRows}
          theme={tooltipTheme}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .viz-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  
  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
  }
</style> 
