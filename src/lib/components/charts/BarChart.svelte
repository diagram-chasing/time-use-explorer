<script lang="ts">
  import * as d3 from 'd3';
  import { formatNumber, formatCompact } from '$lib/utils/formatUtils';
  
  // Raw data input
  export let rawData: any[] = [];
  export let xColumnField: string | null = null;
  export let yColumnField: string | null = null;
  export let topN: number = 10;
  
  // SVG dimensions
  export let svgWidth = 0;
  export let svgHeight = 0;
  export let margin = { top: 0, right: 30, bottom: 30, left: 5 };

  // Processed data
  let data: { category: string; value: number; color?: string }[] = [];
  
  // Scales
  let xScale: d3.ScaleLinear<number, number> = d3.scaleLinear();
  let yScale: d3.ScaleBand<string> = d3.scaleBand();
  
  // Chart derivations
  let effectiveXField: string | null = null;
  let effectiveYField: string | null = null;
  let chartMode: 'count' | 'sum' = 'count';
  
  // Format column labels for display
  function formatColumnLabel(column: string): string {
    return column
      .replace(/_/g, ' ')
      .replace(/^(count|avg|sum|min|max)_/, '$1 ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
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
  
  // Generate tick values for x-axis
  function getXAxisTicks() {
    const max = xScale.domain()[1];
    return [0, max/2, max];
  }
  
  // Check if a field is a demographic field
  function isDemographicField(field: string): boolean {
    // List of demographic fields that should be counted, not summed
    const demographicFields = ['age', 'religion', 'gender', 'state', 'district', 
                              'social_group', 'marital_status', 'education', 'household_size'];
    return demographicFields.includes(field);
  }
  
  // Check if a field is a measure (already aggregated or numeric)
  function isMeasureField(field: string): boolean {
    return field.includes('count_') || field.includes('avg_') || field.includes('sum_') || 
           field.includes('minutes') || field.includes('time');
  }
  
  // Finds count field in the data
  function findCountField(data: any[]): string | null {
    if (data.length === 0) return null;
    
    // Look for count_all first (most common)
    if ('count_all' in data[0]) return 'count_all';
    
    // Look for any field that starts with count_
    const countField = Object.keys(data[0]).find(key => key.startsWith('count_'));
    if (countField) return countField;
    
    // Look for activity_count
    if ('activity_count' in data[0]) return 'activity_count';
    
    return null;
  }

  // Process bar chart data using D3 when inputs change
  $: if (rawData && rawData.length > 0 && xColumnField && yColumnField && svgWidth > 0 && svgHeight > 0) {
    // Find the count field in the data
    const countField = findCountField(rawData);
    
    // Determine if we have pre-aggregated data with counts
    const hasPreAggregatedCounts = countField !== null;
    
    // Determine the chart mode
    if (isDemographicField(xColumnField) && isDemographicField(yColumnField)) {
      // Both are demographic - choose one field to plot
      effectiveXField = xColumnField;
      effectiveYField = null;
      chartMode = 'count';
      
      if (hasPreAggregatedCounts) {
        // Sum up the counts for each unique value of the selected field
        const sumByCategory = d3.rollup(
          rawData,
          group => d3.sum(group, d => getNumericValue(d[countField])),
          d => d[effectiveXField!]
        );
        
        // Convert to array and sort
        data = Array.from(sumByCategory, ([category, value]) => ({ 
          category: String(category), // Ensure category is a string
          value 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topN);
      } else {
        // Fallback to counting rows if no pre-aggregated counts
        const counts = d3.rollup(
          rawData,
          group => group.length,
          d => d[effectiveXField!]
        );
        
        data = Array.from(counts, ([category, value]) => ({ 
          category: String(category),
          value 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topN);
      }
    } else if (isDemographicField(xColumnField) && isMeasureField(yColumnField)) {
      // X is demographic, Y is a measure
      effectiveXField = xColumnField;
      effectiveYField = yColumnField;
      chartMode = 'sum';
      
      // If Y is already a count, use it directly
      if (yColumnField === countField) {
        const sumByCategory = d3.rollup(
          rawData,
          group => d3.sum(group, d => getNumericValue(d[yColumnField])),
          d => d[effectiveXField!]
        );
        
        data = Array.from(sumByCategory, ([category, value]) => ({ 
          category: String(category),
          value 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topN);
      } else {
        // Otherwise use standard measure aggregation
        const sumByCategory = d3.rollup(
          rawData,
          group => d3.sum(group, d => getNumericValue(d[yColumnField!])),
          d => d[effectiveXField!]
        );
        
        data = Array.from(sumByCategory, ([category, value]) => ({ 
          category: String(category),
          value 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topN);
      }
    } else {
      // Default case
      effectiveXField = xColumnField;
      effectiveYField = yColumnField;
      chartMode = 'sum';
      
      const sumByCategory = d3.rollup(
        rawData,
        group => d3.sum(group, d => getNumericValue(d[yColumnField!])),
        d => d[xColumnField!]
      );
      
      data = Array.from(sumByCategory, ([category, value]) => ({ 
        category: String(category),
        value 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
    }
    
    // Setup scales
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;
    
    // X scale (values)
    xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([0, width]);
    
    // Y scale (categories)
    yScale = d3.scaleBand()
      .domain(data.map(d => d.category))
      .range([0, height])
      .padding(0.2);
  }
</script>

<!-- Clear and descriptive chart title -->
<div class="flex flex-col items-start mt-2 text-base-300 ">
  <p class="text-[10px] text-neutral">
    {#if chartMode === 'count' && effectiveXField}
      Showing total count by <span class="bg-base-200 text-neutral px-1 border border-base-300 rounded-xs">{formatColumnLabel(effectiveXField)}</span>
    {:else if effectiveYField?.includes('total')}
      Showing total time spent by each <span class="bg-base-200 text-neutral px-1 border border-base-300 rounded-xs">{formatColumnLabel(effectiveXField || '')}</span>
    {:else if effectiveYField?.includes('count')}
      Showing count by <span class="bg-base-200 text-neutral px-1 border border-base-300 rounded-xs">{formatColumnLabel(effectiveXField || '')}</span>
    {:else if effectiveXField && effectiveYField}
      Showing <span class="bg-base-200 text-neutral px-1 border border-base-300 rounded-xs">{formatColumnLabel(effectiveYField)}</span> by <span class="bg-base-200 text-neutral px-1 border border-base-300 rounded-xs">{formatColumnLabel(effectiveXField)}</span>
    {/if}
  </p>
</div>

<!-- SVG for bar chart -->
<svg width={svgWidth} height={svgHeight}>
  <g transform={`translate(${margin.left - 13}, ${margin.top})`}>
    <!-- Bars with integrated labels -->
    {#each data as bar}
      {@const yPosition = yScale(bar.category) || 0}
      {@const barWidth = xScale(bar.value)}
      {@const labelSpace = 85} <!-- Minimum pixels needed for a readable label -->
      {@const textInsideBar = barWidth >= labelSpace}
      
      <!-- The bar -->
      <rect
        x={0}
        y={yPosition}
        width={barWidth}
        height={yScale.bandwidth() || 0}
        class="fill-neutral"
      >
        <title>{bar.category}: {formatNumber(bar.value, { type: 'standard', decimals: 0 })}</title>
      </rect>
      
      <!-- Label placement depends on bar width -->
      {#if textInsideBar}
        <!-- For wider bars, place label inside with value -->
        <text 
          x={8}
          y={yPosition + (yScale.bandwidth() || 0) / 2} 
          text-anchor="start"
          dominant-baseline="middle"
          class="text-[10px] fill-white"
        >
          <!-- Truncate text if needed -->
          {bar.category.length > 15 ? bar.category.substring(0, 13) + "..." : bar.category}
          <tspan class="text-[10px] fill-white opacity-75"> ({formatCompact(bar.value, 1)})</tspan>
        </text>
      {:else}
        <!-- For smaller bars, place label after the bar with the value -->
        <text 
          x={barWidth + 5}
          y={yPosition + (yScale.bandwidth() || 0) / 2} 
          text-anchor="start"
          dominant-baseline="middle"
          class="text-[10px] fill-base-300"
        >
          {bar.category.length > 15 ? bar.category.substring(0, 13) + "..." : bar.category}
          <tspan class="text-[10px] fill-base-300"> ({formatCompact(bar.value, 1)})</tspan>
        </text>
      {/if}
    {/each}
  </g>
</svg> 