<script lang="ts">
  import { fade } from 'svelte/transition';
  import { formatNumber } from '../utils/formatUtils';
  import { getAppContext } from '$lib/utils/context';
  import { VIEW_MODES } from '$lib/utils/constants';
  const {

    viewMode,
    
  } = getAppContext();
  
  $: isRawDataMode = $viewMode === VIEW_MODES.RAW_DATA;
  // Props for table data
  export let columns: Array<{
    id: string,
    label: string,
    sortable?: boolean,
    formatType?: 'standard' | 'lakhs' | 'millions' | 'billions' | 'compact' | 'percentage',
    formatOptions?: {
      decimals?: number,
      prefix?: string,
      suffix?: string,
    }
  }> = [];
  export let rows: any[] = [];
  export let loading: boolean = false;
  export let emptyMessage: string = "No results to display.";

  // Props for sorting
  export let sortColumn: string = '';
  export let sortDirection: 'asc' | 'desc' = 'asc';
  export let onSort: (column: string) => void = () => {};
  
  // New prop to determine if we should use internal sorting
  export let useInternalSort: boolean = false;
  
  // Props for styling
  export let showStripes: boolean = true;
  export let fadeInRows: boolean = true;
  export let tableClass: string = "data-table flex-1 h-full w-full border-collapse text-left";
  export let headerClass: string = "bg-base-100 sticky top-0 z-10";
  export let headerCellClass: string = "text-xs uppercase font-bold py-2 px-3 text-left border-b border-neutral";
  export let rowClass: string = "hover:bg-base-200 transition-all duration-100";
  export let cellClass: string = "py-1.5 px-3 text-xs border-b border-neutral/10";
  export let loadingClass: string = "p-6 text-center";
  export let emptyClass: string = "p-6 text-center";

  // Function to get cell class based on column
  function getCellClass(columnId: string): string {
    // Right-align numeric columns
    const column = columns.find(col => col.id === columnId);
    const isNumeric = column?.formatType !== undefined;
    return `${cellClass} ${isNumeric ? 'text-right font-mono tabular-nums tracking-tight' : ''}`;
  }

  // Function to format value for display
  function formatValue(value: any, columnId: string): string {
    if (value === null || value === undefined) return '';
    
    // If the value is already a string, assume it's pre-formatted
    if (typeof value === 'string') return value;
    
    // Find column definition
    const column = columns.find(col => col.id === columnId);
    
    // If it's a number and column has format settings
    if (typeof value === 'number' && column?.formatType) {
      return formatNumber(value, {
        type: column.formatType,
        ...column.formatOptions
      });
    }
    
    // Default string conversion
    return String(value);
  }
  
  // Function to sort rows based on a column
  function sortRows(rows: any[], columnId: string, direction: 'asc' | 'desc'): any[] {
    if (!rows.length || !columnId) return rows;
    
    return [...rows].sort((a, b) => {
      const aValue = a[columnId];
      const bValue = b[columnId];
      
      // Handle null or undefined values
      if (aValue === null || aValue === undefined) return direction === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return direction === 'asc' ? 1 : -1;
      
      // Parse value from formatted strings like "90 min" or "9.8 K"
      const parseFormattedValue = (value: any): number => {
        if (typeof value === 'number') return value;
        
        // Convert to string for handling
        const strValue = String(value);
        
        // Extract number from strings like "90 min", "9.8 K", etc.
        const numMatch = strValue.match(/^([\d,.]+)\s*(?:min|K|L|M)?/);
        if (numMatch) {
          // Get the number part
          let num = parseFloat(numMatch[1].replace(/,/g, ''));
          
          // Apply multiplier based on suffix
          if (strValue.includes('K')) num *= 1000;
          else if (strValue.includes('L')) num *= 100000;
          else if (strValue.includes('M')) num *= 1000000;
          
          return num;
        }
        
        return NaN;
      };
      
      // Parse values
      const aNum = parseFormattedValue(aValue);
      const bNum = parseFormattedValue(bValue);
      
      // If both are valid numbers after parsing, compare numerically
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Fallback to string comparison for non-numeric values
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return direction === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });
  }
  
  // Apply internal sorting if enabled
  $: sortedRows = useInternalSort && rows.length 
    ? sortRows(rows, sortColumn || (rows.length > 0 && numericColumns.length > 0 ? numericColumns[0] : ''), sortDirection) 
    : rows;
    
  // Extract numeric columns for default sorting
  $: numericColumns = rows.length > 0 
    ? Object.keys(rows[0]).filter(key => 
        typeof rows[0][key] === 'number' || 
        (typeof rows[0][key] === 'string' && !isNaN(parseFloat(rows[0][key]))))
    : [];
    
  // Handle sort click
  function handleSort(column: string) {
    if (useInternalSort) {
      if (sortColumn === column) {
        // Toggle direction if same column
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // New column, set to default direction
        sortColumn = column;
        sortDirection = 'asc';
      }
    } 
    // Always call the external handler
    onSort(column);
  }
</script>

{#if rows.length > 0 && columns.length > 0}
  <div class="overflow-x-auto {isRawDataMode ? 'max-h-[72vh]' : 'max-h-[74.4vh]'}">
    <table class={tableClass}>
      <thead>
        <tr class={headerClass}>
          {#each columns as column}
            <th class={`${headerCellClass} ${column.formatType ? 'text-right' : ''}`}>
              {#if useInternalSort || column.sortable}
                <button 
                  class="flex items-center w-full {column.formatType ? 'justify-end' : 'justify-start'} hover:text-yellow"
                  on:click={() => handleSort(column.id)}
                >
                  {column.label}
                  {#if sortColumn === column.id}
                    <span class="inline-block ml-1 text-[10px] opacity-70">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  {/if}
                </button>
              {:else}
                <span class="opacity-70">{column.label}</span>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each (useInternalSort ? sortedRows : rows) as row, i}
          <tr 
            in:fade={{duration: fadeInRows ? 80 : 0, delay: fadeInRows ? i * 5 : 0}} 
            class="{rowClass} {showStripes && i % 2 === 0 ? 'bg-base-100' : showStripes ? 'bg-base-200/20' : ''}"
          >
            {#each columns as column}
              <td class={getCellClass(column.id)}>{formatValue(row[column.id], column.id)}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if loading}
  <div class={loadingClass}>
    <div class="flex flex-col items-center justify-center">
      <div class="w-6 h-6 border-2 border-yellow border-t-transparent rounded-full animate-spin mb-2"></div>
      <p class="text-xs" style="font-family: var(--font-ui);">Loading data...</p>
    </div>
  </div>
{:else}
  <div class={emptyClass}>
    <p class="text-xs" style="font-family: var(--font-ui);">{emptyMessage}</p>
  </div>
{/if}

<style>
  /* Custom styles */
  :global(.tabular-nums) {
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
  }
</style> 