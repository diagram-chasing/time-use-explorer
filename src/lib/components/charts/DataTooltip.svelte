<script lang="ts">
  import { fade } from 'svelte/transition';
  
  // Position props
  export let x = 0;
  export let y = 0;
  
  // Content props (structured data)
  export let rows: {
    label: string;
    value: string;
    highlight?: boolean;
  }[] = [];
  
  // Display props
  export let visible = false;
  export let maxWidth = 280;
  
  // Appearance props
  export let theme: 'light' | 'dark' = 'light';
</script>

{#if visible}
  <div 
    class="absolute z-50 shadow-md rounded-sm p-3 pointer-events-none translate-x-[-50%] translate-y-[-100%] mt-[-10px]
           {theme === 'dark' ? 'bg-neutral text-white border-neutral-focus' : 'bg-white text-neutral border-neutral'} border"
    style="left: {x}px; top: {y}px; max-width: {maxWidth}px;"
    transition:fade={{ duration: 150 }}
  >
    <div class="tooltip-content space-y-2.5">
      {#each rows as row}
        <div class="tooltip-row">
          <div class="font-semibold text-xs mb-1">{row.label}:</div>
          <div class="text-xs {row.highlight ? 'font-bold text-primary' : ''}">{row.value}</div>
        </div>
      {/each}
    </div>
    
    <!-- Arrow pointer -->
    <div class="absolute w-0 h-0 left-1/2 -translate-x-1/2 -bottom-[6px]
                border-l-[6px] border-l-transparent 
                border-r-[6px] border-r-transparent
                {theme === 'dark' ? 'border-t-[6px] border-t-neutral-focus' : 'border-t-[6px] border-t-neutral'}">
    </div>
  </div>
{/if}
