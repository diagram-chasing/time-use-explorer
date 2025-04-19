<script lang="ts">
	import { formatCompact, formatNumber } from "$lib/utils/formatUtils";

  export let currentPage: number;
  export let totalPages: number;
  export let loading: boolean = false;
  export let changePage: (newPage: number) => void;
  
  // Calculate which page numbers to show
  $: pageRange = getPageRange(currentPage, totalPages);
  
  // Function to get the range of pages to display
  function getPageRange(current: number, total: number): (number | string)[] {
    const maxButtons = 7; // Increased for better visibility
    const pages: (number | string)[] = [];
    
    if (total <= maxButtons) {
      // Show all pages
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate middle range - more pages around current
      let start = Math.max(2, current - 2);
      let end = Math.min(total - 1, current + 2);
      
      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (end < total - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(total);
    }
    
    return pages;
  }
  
  // Function to handle page change
  function handlePageChange(newPage: number): void {
    if (newPage >= 1 && newPage <= totalPages && !loading) {
      changePage(newPage);
    }
  }
</script>

{#if totalPages > 1}
  <div class="border-t border-neutral mt-4 py-2 bg-base-100">
    <div class="flex items-center justify-between px-3 py-1">
      <div class="text-xs" style="font-family: var(--font-ui);">
        Page {currentPage} of {formatNumber(totalPages, {decimals: 0})}
      </div>
      
      <nav class="flex items-center gap-1">
        <!-- Previous button -->
        <button
          class="h-4 px-1 text-xs flex items-center justify-center border border-neutral text-neutral disabled:opacity-30 disabled:cursor-not-allowed"
          on:click={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          aria-label="Previous page"
        >
          &lsaquo;
        </button>
        
        <!-- Page numbers -->
        {#each pageRange as page}
          {#if page === '...'}
            <span class="h-4 px-1 text-xs flex items-center justify-center text-base-300">&hellip;</span>
          {:else if typeof page === 'number'}
            <button
              class="h-4 px-1 text-xs flex items-center justify-center overflow-hidden border border-neutral text-xs font-mono transition-colors {currentPage === page ? 'bg-neutral text-white' : 'bg-base-100 hover:bg-base-200'}"
              on:click={() => handlePageChange(page)}
              aria-label="Go to page {page}"
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {formatCompact(page, 0)}
            </button>
          {/if}
        {/each}
        
        <!-- Next button -->
        <button
          class="h-4 px-1 flex items-center justify-center border border-neutral text-neutral disabled:opacity-30 disabled:cursor-not-allowed"
          on:click={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          aria-label="Next page"
        >
          &rsaquo;
        </button>
      </nav>
    </div>
  </div>
{/if} 