<script lang="ts">
  import * as d3 from 'd3';
  import { formatNumber } from '$lib/utils/formatUtils';
  
  // Raw data input
  export let rawData: any[] = [];
  export let geoField: string | null = null;
  export let valueField: string | null = null;
  
  // Required components for map rendering
  export let mapGeoData: any = null;
  export let isLoadingGeoData = false;
  export let mapError = '';
  
  // Processed data
  let data: { region: string; value: number }[] = [];
  
  // Helper to get numeric value regardless of type
  function getNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Try to extract number from string like "30.0 min"
      const match = value.match(/(\d+(\.\d+)?)/);
      if (match) return parseFloat(match[1]);
      return 0;
    }
    return 0;
  }
  
  // Process map data when inputs change
  $: if (rawData && rawData.length > 0 && valueField) {
    // Determine geographic column (state or district)
    const geoColumnToUse = geoField || 
      (rawData[0].hasOwnProperty('state') ? 'state' : 
      (rawData[0].hasOwnProperty('district') ? 'district' : null));
    
    if (geoColumnToUse) {
      // Group by geographic entity and sum values
      const grouped = d3.rollup(
        rawData,
        v => d3.sum(v, d => getNumericValue(d[valueField])),
        d => d[geoColumnToUse]
      );
      
      data = Array.from(grouped, ([region, value]) => ({ 
        region, 
        value 
      }));
    } else {
      data = [];
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
</script>

<div class="h-[150px] p-1">
  {#if isLoadingGeoData}
    <div class="flex justify-center items-center h-full text-base-300">
      <p class="text-[9px]">Loading data...</p>
    </div>
  {:else if mapError}
    <div class="flex justify-center items-center h-full text-base-300">
      <p class="text-[9px]">{mapError}</p>
    </div>
  {:else if mapGeoData && data.length > 0}
    <!-- Compact map visualization -->
    <div class="h-full flex flex-col">
      <!-- Skip map view and just show top regions with a color scale -->
      <div class="flex-grow overflow-y-auto">
        <table class="w-full border-collapse text-[8px]">
          <thead>
            <tr>
              <th class="py-0.5 px-1 text-left border-b border-neutral/10 font-semibold bg-base-200">Region</th>
              <th class="py-0.5 px-1 text-left border-b border-neutral/10 font-semibold bg-base-200">
                {valueField ? formatColumnLabel(valueField) : 'Value'}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each data.sort((a, b) => b.value - a.value).slice(0, 5) as region}
              <tr>
                <td class="py-0.5 px-1 border-b border-neutral/10">{region.region}</td>
                <td class="py-0.5 px-1 border-b border-neutral/10">{formatNumber(region.value, { type: 'standard', decimals: 1 })}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      <!-- Color scale legend -->
      <div class="flex flex-col mt-1 h-5">
        <div class="h-2.5 bg-gradient-to-r from-[#cceeff] to-[#0066cc] rounded-sm"></div>
        <div class="flex justify-between text-[7px] mt-0.5">
          <span>{formatNumber(d3.min(data, d => d.value) || 0, { type: 'standard', decimals: 1 })}</span>
          <span>{formatNumber(d3.max(data, d => d.value) || 0, { type: 'standard', decimals: 1 })}</span>
        </div>
      </div>
    </div>
  {/if}
</div> 