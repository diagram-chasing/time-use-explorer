<script lang="ts">
  import Seo from '$lib/components/SEO.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Results from '$lib/components/Results.svelte';
  import About from '$lib/components/About.svelte';
  import VisualizationPanel from '$lib/components/VisualizationPanel.svelte';
  import { notifications } from '$lib/utils/notificationUtils';
  import { getAppContext } from '$lib/utils/context';
  import { VIEW_MODES } from '$lib/utils/constants';
  
  const { viewMode } = getAppContext();
  
  function handleComponentError(component: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    notifications.technicalError(`${component} error: ${errorMessage}`);
  }
</script>

<Seo />

<div class="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full overflow-y-clip">
  {#if $viewMode !== VIEW_MODES.ABOUT}
    <!-- Sidebar on the left column -->
    <div class="flex flex-col gap-4 lg:h-[calc(96svh-6.2rem)]">
      <div class="flex-1 h-1/2">
        <svelte:boundary onerror={(error: unknown, reset: () => void) => handleComponentError('Sidebar', error)}>
          <Sidebar />
          
          {#snippet failed(error, reset)}
            <div class="bg-base-200 p-4 rounded-md text-sm">
              <p class="mb-2">Filter panel could not be displayed</p>
              <button 
                class="text-xs bg-neutral text-white px-2 py-1 rounded-sm" 
                on:click={reset}
              >
                Try again
              </button>
            </div>
          {/snippet}
        </svelte:boundary>
      </div>
      <!-- Visualization panel under sidebar on desktop only -->
      {#if $viewMode !== VIEW_MODES.ABOUT && $viewMode !== VIEW_MODES.RAW_DATA}
        <div class="hidden lg:block flex-1 h-1/2 mb-4">
          <VisualizationPanel />
        </div>
      {:else}
        <div class="hidden -z-1 h-1/2 flex-1 lg:block mb-4">

        </div>
      {/if}
    </div>
    
    <!-- Results on the right column -->
    <div class="lg:col-span-3 h-full">
     
        <Results />
        
      
    </div>
  {:else}
    <!-- About view takes full width -->
    <div class="lg:col-span-4 mb-4 h-full">
      <About />
    </div>
  {/if}
</div>
