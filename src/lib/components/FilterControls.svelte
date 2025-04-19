<script lang="ts">
  import { Plus, Trash } from "lucide-svelte";
  import { notifications } from "$lib/utils/notificationUtils";
  
  // Prop types
  export let filters: Array<{column: string, operator: string, value: any, enabled: boolean, precision?: string}>;
  export let allColumns: Array<{id: string, label: string, type: string, hidden?: boolean}>;
  export let onAdd = () => {};
  export let onRemove = (index: number) => {};
  export let onChange = (index: number, field: string, value: any) => {};
  
  // Operators by column type
  const operatorsByType: Record<string, string[]> = {
    string: ['=', '!=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN'],
    number: ['=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN'],
    boolean: ['=', '!='],
    date: ['=', '!=', '>', '<', '>=', '<='],
    time: ['=', '!=', '>', '<', '>=', '<=', 'BETWEEN'],
    time_range: ['=', '!=', '>', '<', '>=', '<=', 'BETWEEN', 'NOT BETWEEN']
  };
  
  // Filter the columns to only show non-hidden ones in the UI
  const visibleColumns = allColumns.filter(col => !col.hidden);
  
  // Time-related column IDs
  const timeColumns = ['time_from', 'time_to'];
  
  // Debounce timeout for validation
  let validationTimeout: ReturnType<typeof setTimeout>;
  
  // Validate time format (HH:MM)
  function isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }
  
  // Get the column type
  function getColumnType(columnId: string): string {
    // Special handling for time columns
    if (timeColumns.includes(columnId)) {
      return 'time';
    }
    
    const column = allColumns.find(c => c.id === columnId);
    return column ? column.type : 'string';
  }
  
  // Get operators for a column
  function getOperatorsForColumn(columnId: string): string[] {
    const type = getColumnType(columnId);
    return operatorsByType[type] || operatorsByType.string;
  }
  
  // Check if operator is BETWEEN (needs two values)
  function isBetweenOperator(operator: string): boolean {
    return operator === 'BETWEEN' || operator === 'NOT BETWEEN';
  }
  
  // Format the value for the filter
  function formatFilterValue(filter: {column: string, operator: string, value: any}): string {
    if (isBetweenOperator(filter.operator)) {
      // For BETWEEN, return a comma-separated value if it already has a comma
      return filter.value || '';
    }
    return filter.value || '';
  }
  
  // Handle time input change with validation
  function handleTimeInputChange(index: number, value: string, isStartTime: boolean): void {
    const currentFilter = filters[index];
    if (!value) {
      // Allow empty values
      const otherTime = isStartTime 
        ? currentFilter.value?.split(',')[1] || ''
        : currentFilter.value?.split(',')[0] || '';
      onChange(index, 'value', isStartTime ? `,${otherTime}` : `${otherTime},`);
      return;
    }

    // Clear any existing timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    // Set a new timeout to validate after user stops typing
    validationTimeout = setTimeout(() => {
      if (isValidTimeFormat(value)) {
        const otherTime = isStartTime 
          ? currentFilter.value?.split(',')[1] || ''
          : currentFilter.value?.split(',')[0] || '';
        onChange(index, 'value', isStartTime ? `${value},${otherTime}` : `${otherTime},${value}`);
      } else {
        notifications.error(`Invalid time format. Please use HH:MM format (e.g. 09:00 or 14:30)`);
      }
    }, 500); // Wait 500ms after user stops typing
  }
  
  // Handle time_range special case
  function handleTimeRangeChange(index: number, field: string, value: any) {
    // If changing from a different column type to time_range
    if (field === 'column' && value === 'time') {
      onChange(index, 'column', value);
      // Set default operator to BETWEEN for time_range
      onChange(index, 'operator', 'BETWEEN');
      // Set default precision to overlap
      onChange(index, 'precision', 'overlap');
    } else {
      onChange(index, field, value);
    }
  }
  
  // Toggle precision between 'overlap' and 'contain'
  function togglePrecision(index: number, currentPrecision: string) {
    const newPrecision = currentPrecision === 'overlap' ? 'contain' : 'overlap';
    onChange(index, 'precision', newPrecision);
  }
</script>

<div class="space-y-2">
  {#if filters.length > 0}
    <div class="control-label">FILTERS</div>
  {/if}
  
  {#each filters as filter, index}
    <div class="flex flex-wrap items-end gap-1.5 mb-2 {index < filters.length - 1 ? 'pb-2 border-b border-dashed border-neutral/10' : ''}">
      <div class="w-36">
        <select 
          class="control-input"
          bind:value={filter.column}
          on:change={() => handleTimeRangeChange(index, 'column', filter.column)}
        >
          {#each visibleColumns as column}
            <option value={column.id}>{column.label}</option>
          {/each}
          <!-- Special case: add time option for filtering -->
          <option value="time">Time</option>
        </select>
      </div>
      
      <div class="w-28">
        <select 
          class="control-input"
          bind:value={filter.operator}
          on:change={() => onChange(index, 'operator', filter.operator)}
        >
          {#each getOperatorsForColumn(filter.column) as operator}
            <option value={operator}>{operator}</option>
          {/each}
        </select>
      </div>
      
      {#if filter.column === 'time' && isBetweenOperator(filter.operator)}
        <div class="flex flex-col gap-1 w-72">
          <div class="flex gap-1">
            <input 
              type="text" 
              class="control-input w-1/2"
              placeholder="Start time (e.g. 09:00)"
              value={filter.value?.split(',')[0] || ''}
              on:input={(e) => {
                const input = e.target as HTMLInputElement;
                handleTimeInputChange(index, input.value, true);
              }}
            />
            <span class="flex items-center">and</span>
            <input 
              type="text" 
              class="control-input w-1/2"
              placeholder="End time (e.g. 17:00)"
              value={filter.value?.includes(',') ? filter.value?.split(',')[1] || '' : ''}
              on:input={(e) => {
                const input = e.target as HTMLInputElement;
                handleTimeInputChange(index, input.value, false);
              }}
            />
          </div>
          <div class="flex items-center text-xs">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="mr-1"
                checked={filter.precision === 'contain'}
                on:change={() => togglePrecision(index, filter.precision || 'overlap')}
              />
              <span>Exact time range</span>
            </label>
          </div>
        </div>
      {:else if isBetweenOperator(filter.operator)}
        <div class="w-72 flex gap-1">
          <input 
            type="text" 
            class="control-input w-1/2"
            placeholder="Start value"
            value={filter.value?.split(',')[0] || ''}
            on:input={(e) => {
              const input = e.target as HTMLInputElement;
              if (filter.column === 'time') {
                handleTimeInputChange(index, input.value, true);
              } else {
                const endValue = filter.value?.includes(',')
                  ? filter.value?.split(',')[1] || ''
                  : '';
                onChange(index, 'value', `${input.value},${endValue}`);
              }
            }}
          />
          <span class="flex items-center">and</span>
          <input 
            type="text" 
            class="control-input w-1/2"
            placeholder="End value"
            value={filter.value?.includes(',') ? filter.value?.split(',')[1] || '' : ''}
            on:input={(e) => {
              const input = e.target as HTMLInputElement;
              if (filter.column === 'time') {
                handleTimeInputChange(index, input.value, false);
              } else {
                const startValue = filter.value?.includes(',')
                  ? filter.value?.split(',')[0] || ''
                  : filter.value || '';
                onChange(index, 'value', `${startValue},${input.value}`);
              }
            }}
          />
        </div>
      {:else}
        <div class="w-36">
          <input 
            type="text" 
            class="control-input"
            bind:value={filter.value}
            on:input={() => onChange(index, 'value', filter.value)}
            placeholder="Value"
          />
        </div>
      {/if}
      
      <button 
        class="p-1 border border-neutral text-neutral hover:bg-red hover:text-white hover:border-red transition-colors"
        on:click={() => onRemove(index)}
        title="Remove filter"
      >
        <Trash class="w-3 h-3" />
      </button>
    </div>
  {/each}
  
  <button 
    class="flex items-center gap-1 text-xs py-1 px-2 border border-neutral text-neutral hover:bg-neutral hover:text-white"
    on:click={onAdd}
  >
    <Plus class="w-3 h-3" /> Add Filter
  </button>
</div>