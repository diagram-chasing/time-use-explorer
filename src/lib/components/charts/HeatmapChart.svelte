<script lang="ts">
  import * as d3 from 'd3';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { twemoji } from 'svelte-twemoji';
  import { getActivityEmoji, getActivityCategory } from './heatmapUtils';
  import { createEventDispatcher } from 'svelte';
  
  // Create event dispatcher
  const dispatch = createEventDispatcher();
  
  // Raw data input
  export let rawData: any[] = [];
  export let rowField: string | null = null;
  export let columnField: string | null = null;
  export let valueField: string | null = null;
  export let maxRowsToShow = 10;
  export let maxColumnsToShow = 10;
  
  // SVG dimensions
  export let svgWidth = 0;
  export let svgHeight = 0;
  export let margin = { top: 40, right: 10, bottom: 10, left: 10 };
  
  // Processed data
  let data: { row: string; column: string; value: number }[] = [];
  
  // Scales
  let xScale: d3.ScaleBand<string> = d3.scaleBand();
  let yScale: d3.ScaleBand<string> = d3.scaleBand();
  let colorScale: d3.ScaleQuantize<string> = d3.scaleQuantize<string>();
  
  // Base margin calculation
  function calculateMargins() {
    // Start with base margins
    const newMargin = { ...margin };
    
    if (data.length === 0) return newMargin;
    
    // Adjust left margin based on longest row name
    const rowLabels = Array.from(new Set(data.map(d => d.row))).filter(Boolean);
    if (rowLabels.length > 0) {
      const maxRowLength = Math.min(15, Math.max(...rowLabels.map(r => String(r).length)));
      // Allocate approximately 6px per character
      newMargin.left = Math.min(65, Math.max(10, maxRowLength * 6)); 
    }
    
    // Adjust top margin based on whether we're showing emojis
    if (columnField === 'activity_code') {
      newMargin.top = 35; // More space for emojis
    } else {
      newMargin.top = 25; // Less space for text labels
    }
    
    return newMargin;
  }
  
  // Reactive margin calculation after data is processed
  $: adjustedMargin = calculateMargins();
  
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
  
  // Process heatmap data when inputs change
  $: if (rawData && rawData.length > 0 && rowField && columnField && valueField && svgWidth > 0 && svgHeight > 0) {
    // Create a map to store the aggregated values
    const valueMap = new globalThis.Map();
    
    // Process data to create row/column/value entries
    rawData.forEach(d => {
      const row = d[rowField];
      const column = d[columnField];
      const value = getNumericValue(d[valueField]);
      
      // Skip empty or null values
      if (!row || !column || value === 0) return;
      
      // Create key for the row-column combination
      const key = `${row}-${column}`;
      
      // If this combination already exists, update with average or sum
      if (valueMap.has(key)) {
        const existingEntry = valueMap.get(key);
        existingEntry.value = (existingEntry.value + value) / 2; // Simple average
        valueMap.set(key, existingEntry);
      } else {
        // Add new entry
        valueMap.set(key, { row, column, value });
      }
    });
    
    // Convert map to array for D3
    let fullData = Array.from(valueMap.values());
    
    // Get unique row and column values for scales
    const rows = Array.from(new Set(fullData.map(d => d.row)));
    const columns = Array.from(new Set(fullData.map(d => d.column)));
    
    // Limit to top rows/columns if too many
    let filteredRows = rows;
    let filteredColumns = columns;
    
    if (rows.length > maxRowsToShow) {
      // Group by row and sum values
      const rowSums = d3.rollup(
        fullData,
        v => d3.sum(v, d => d.value),
        d => d.row
      );
      
      // Take top N rows by value
      filteredRows = Array.from(rowSums.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxRowsToShow)
        .map(d => d[0]);
    }
    
    if (columns.length > maxColumnsToShow) {
      // Group by column and sum values
      const colSums = d3.rollup(
        fullData,
        v => d3.sum(v, d => d.value),
        d => d.column
      );
      
      // Take top N columns by value
      filteredColumns = Array.from(colSums.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxColumnsToShow)
        .map(d => d[0]);
    }
    
    // Filter heatmap data to only include top rows/columns
    data = fullData.filter(d => 
      filteredRows.includes(d.row) && filteredColumns.includes(d.column)
    );
    
    // Set up scales based on processed data
    const width = svgWidth - adjustedMargin.left - adjustedMargin.right;
    const height = svgHeight - adjustedMargin.top - adjustedMargin.bottom;
    
    // X scale (columns)
    xScale = d3.scaleBand()
      .domain(filteredColumns)
      .range([0, width])
      .padding(0.05);
    
    // Y scale (rows)
    yScale = d3.scaleBand()
      .domain(filteredRows)
      .range([0, height])
      .padding(0.05);
    
    // Color scale (values)
    const minValue = d3.min(data, d => d.value) || 0;
    const maxValue = d3.max(data, d => d.value) || 1;
    
    colorScale = d3.scaleQuantize<string>()
      .domain([minValue, maxValue])
      .range([
        "#af6c0d",
        "#b87f2a",
        "#c19143",
        "#caa35c",
        "#d4b575",
        "#ddc68f",
        "#e8d8a9",
        "#f3e9c4",
        "#fffae0"
      ].reverse());
  }
  
  // Format column labels for display
  function formatColumnLabel(column: string): string {
    if (column === 'activity_code') {
      return 'Activity';
    }
    return column
      .replace(/_/g, ' ')
      .replace(/^(count|avg|sum|min|max)_/, '$1 ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Truncate text with ellipsis
  function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  // Tooltip handlers
  function handleMouseOver(event: MouseEvent, cell: { row: string; column: string; value: number }) {
    // Get formatted values for display
    const rowLabel = formatColumnLabel(rowField || '');
    const colLabel = formatColumnLabel(columnField || '');
    const valueLabel = formatColumnLabel(valueField || '');
    
    // Create structured data for tooltip
    const tooltipData = [
      { label: rowLabel, value: cell.row },
      { label: colLabel, value: cell.column },
      { label: valueLabel, value: formatNumber(cell.value, { type: 'standard', decimals: 1 }), highlight: true }
    ];
    
    // Calculate tooltip position (relative to visualization container)
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect();
    const svgRect = (event.currentTarget as SVGRectElement).ownerSVGElement?.getBoundingClientRect();
    
    if (svgRect) {
      const x = rect.left - svgRect.left + rect.width / 2;
      const y = rect.top - svgRect.top;
      
      // Dispatch event to parent with tooltip info
      dispatch('showTooltip', { x, y, rows: tooltipData });
    }
  }
  
  function handleMouseOut() {
    dispatch('hideTooltip');
  }
</script>

<!-- Title showing what the chart represents -->
<div class="flex text-[10px] my-2">
  <p class="text-neutral">
    {formatColumnLabel(valueField || '')} by <span class="bg-base-200 text-neutral px-1 border border-base-300 rounded-xs">{formatColumnLabel(rowField || '')}</span> and <span class="bg-base-200 text-neutral px-1 border border-base-300 rounded-xs">{formatColumnLabel(columnField || '')}</span>
  </p>
</div>

<svg width={svgWidth} height={svgHeight} class="relative">
  <g transform={`translate(${adjustedMargin.left}, ${adjustedMargin.top})`}>
    <!-- Heatmap grid cells -->
    {#each data as cell}
      <rect
        x={xScale(cell.column) || 0}
        y={yScale(cell.row) || 0}
        width={xScale.bandwidth() || 0}
        height={yScale.bandwidth() || 0}
        fill={colorScale(cell.value)}
        stroke="#fff"
        stroke-width="0.5"
        class="hover:stroke-2 hover:stroke-neutral"
        on:mouseover={(event) => handleMouseOver(event, cell)}
        on:mouseout={handleMouseOut}
      />
    {/each}
    
    <!-- Column headers (using emojis for activities) -->
    {#each xScale.domain() as column, i}
      {#if columnField === 'activity_code'}
        <foreignObject
          x={(xScale(column) || 0) + (xScale.bandwidth() || 0) / 2 - 7}
          y={-25}
          width="20"
          height="20"
        >
          <div use:twemoji class="emoji-container">
            {getActivityEmoji(column)}
          </div>
        </foreignObject>
       
      {:else}
        <text 
          x={(xScale(column) || 0) + (xScale.bandwidth() || 0) / 2} 
          y={-8}
          text-anchor="middle" 
          dominant-baseline="middle"
          transform={`rotate(-30, ${(xScale(column) || 0) + (xScale.bandwidth() || 0) / 2}, -8)`}
          class="text-[7px] fill-base-300"
        >
          {truncateText(column, 10)}
        </text>
      {/if}
    {/each}
    
    <!-- Row labels -->
    {#each yScale.domain() as row}
      <text 
        x={-68} 
        y={(yScale(row) || 0) + (yScale.bandwidth() || 0) / 2}
        text-anchor="start" 
        dominant-baseline="middle"
        class="text-[10px] fill-neutral"
      >
        {truncateText(row, 8)}
      </text>
    {/each}
  </g>
</svg>

<style>
  
  
  svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }
  
  .emoji-container {
    font-size: 18px;
    text-align: center;
  }
  
  .row-label {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style> 