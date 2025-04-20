<script lang="ts">
	import '../app.css';
	import { fly, fade } from 'svelte/transition';
	import { Database, BarChart, Clock, Info } from 'lucide-svelte';
	import { Toaster, toast } from 'svelte-sonner';
	import DiagramChasingLogo from '$lib/assets/dc-logo-no-text.png';
	import Logo from '$lib/assets/logo.webp';
	import { VIEW_MODES, FEATURES } from '$lib/utils/constants';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { setAppContext } from '$lib/utils/context';
  import { NotificationType, type NotificationData, notifications } from '$lib/utils/notificationUtils';
  import { page } from '$app/stores';
  import { parseStateFromURL } from '$lib/utils/urlStateUtils';
  import { get } from 'svelte/store';
  
  // Set up the context for all children components to use
  const context = setAppContext();
  const { viewMode, setViewMode } = context;
  
  // Handle URL state processing after DB is ready
  async function processUrlState() {
    if (!browser || !FEATURES.ENABLE_URL_STATE) return;
    
    const urlState = parseStateFromURL($page.url.searchParams);
    
    // Skip if no view mode in URL
    if (!urlState.viewMode) return;
    
    try {
      // Dispatch event that URL query processing has started
      window.dispatchEvent(new CustomEvent('url_query_processing'));
      
      // Apply URL state if present - first set all state values
      // Set view mode first, but don't trigger queries yet
      context.viewMode.set(urlState.viewMode);
      context.summaryMode.set(urlState.viewMode === VIEW_MODES.SUMMARY);
      context.timeAnalysisMode.set(urlState.viewMode === VIEW_MODES.TIME_ANALYSIS);
      
      // Apply additional state if present (specific to each view mode)
      if (urlState.filters && urlState.filters.length > 0) {
        context.filters.set(urlState.filters);
      }
      
      if (urlState.selectedColumns && urlState.selectedColumns.length > 0) {
        context.selectedColumns.set(urlState.selectedColumns);
      }
      
      if (urlState.currentPage && urlState.currentPage > 1) {
        context.currentPage.set(urlState.currentPage);
      }
      
      if (urlState.demographicColumns && urlState.demographicColumns.length > 0) {
        context.demographicColumns.set(urlState.demographicColumns);
      }
      
      if (urlState.activityColumn) {
        context.activityColumn.set(urlState.activityColumn);
      }
      
      if (urlState.aggregations && urlState.aggregations.length > 0) {
        context.aggregations.set(urlState.aggregations);
      }
      
      if (urlState.groupByColumns && urlState.groupByColumns.length > 0) {
        context.groupByColumns.set(urlState.groupByColumns);
      }
      
      console.log("Executing query from URL state...");
      // Now execute the appropriate query after all state is set
      if (urlState.viewMode === VIEW_MODES.RAW_DATA) {
        await context.executeRawDataQuery();
      } else if (urlState.viewMode === VIEW_MODES.SUMMARY) {
        await context.executeSummaryQuery();
      } else if (urlState.viewMode === VIEW_MODES.TIME_ANALYSIS) {
        await context.executeTimeAnalysis();
      }
      
      // Show success message after query is executed
      if (pendingUrlToast) {
        notifications.success("Shared query loaded successfully!");
        pendingUrlToast = false;
      }
      
      // Dispatch event that URL query processing has completed
      window.dispatchEvent(new CustomEvent('url_query_completed'));
    } catch (err) {
      console.error('Error processing URL state:', err);
      notifications.error(`Error loading query from URL: ${err}`);
      
      if (pendingUrlToast) {
        pendingUrlToast = false;
      }
      
      // Dispatch event that URL query processing has completed (even if with error)
      window.dispatchEvent(new CustomEvent('url_query_completed'));
    }
  }
  
  // Flag to track if URL has been processed
  let urlProcessed = false;
  let pendingUrlToast = false;
  
  // Initialize DuckDB when the component mounts
  onMount(async () => {
    if (browser) {
      try {
        // Check if we have URL state that will need processing
        if (FEATURES.ENABLE_URL_STATE) {
          const urlState = parseStateFromURL($page.url.searchParams);
          if (urlState.viewMode) {
            // Show loading toast since we have URL state to process
            notifications.info("Query from URL detected - waiting for dataset to load...");
            pendingUrlToast = true;
          }
        }
        
        // Initialize database first but don't wait for full dataset to load
        await context.initializeDuckDB();
        
        // Set up a listener for the full dataset loaded event
        // This is better than using dbReady because we need the full dataset to be available
        const onFullDatasetLoaded = (event: CustomEvent) => {
          console.log("Full dataset loaded, now processing URL state");
          if (!urlProcessed) {
            if (pendingUrlToast) {
              notifications.info("Dataset loaded - executing saved query...");
            }
            processUrlState();
            urlProcessed = true;
          }
        };
        
        // Check if already loaded
        if (get(context.dbReady)) {
          // Even if dbReady is true, we need to make sure the full dataset is loaded
          // So let's check if there was already a full_dataset_loaded event
          // If not, we'll wait for it
          setTimeout(() => {
            if (!urlProcessed) {
              console.log("DB is ready but waiting for full dataset");
              window.addEventListener('full_dataset_loaded', onFullDatasetLoaded);
            }
          }, 100);
        } else {
          // DB not ready yet, add a listener for the full dataset loaded event
          window.addEventListener('full_dataset_loaded', onFullDatasetLoaded);
        }
      } catch (err) {
        console.error('Error initializing:', err);
      }
      
      // Set up a global error handler
      window.addEventListener('error', (event) => {
        console.error('Global error:', event.error || event.message);
        const errorMessage = event.error?.message || event.message || 'Unknown error';
        // Use our notification system with technical flag for UI errors
        notifications.error(`Global error: ${errorMessage}`, true);
      });
      
      // Set up unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        const errorMessage = event.reason?.message || 'Unknown promise error';
        // Use our notification system with technical flag for promise errors
        notifications.error(`Promise error: ${errorMessage}`, true);
      });
      
      // Unified notification event listener
      window.addEventListener('notification', ((event: CustomEvent<NotificationData>) => {
        const { message, type, duration } = event.detail || {};
        
        if (message) {
          switch (type) {
            case NotificationType.ERROR:
              toast.error(message, { duration });
              break;
            case NotificationType.SUCCESS:
              toast.success(message, { duration });
              break;
            case NotificationType.INFO:
              toast.message(message, { duration });
              break;
            case NotificationType.WARNING:
              toast.warning ? toast.warning(message, { duration }) : toast.message(message, { duration });
              break;
            default:
              toast.message(message, { duration });
          }
        }
      }) as EventListener);
    }
  });
</script>

<div class="flex flex-col min-h-screen h-full max-w-7xl mx-auto p-2">
	<header class="mb-4 pb-3 border-b border-neutral">
		<div in:fly={{y: -10, duration: 200}} class="flex flex-col md:flex-row md:items-end justify-between gap-3">
			<div class="flex items-center gap-2">
				<img src={Logo} alt="Logo" class="size-12" />
				<div>
					<h1 class="text-xl font-mono tracking-tight mb-1 text-neutral">
						INDIA TIME USE SURVEY EXPLORER
					</h1>
					<p class="text-xs text-neutral" style="font-family: var(--font-ui);">
						Explore, subset and summarize data from the National Time Use Survey.
					</p>
				</div>
			</div>
			
			<!-- View Mode Selector -->
			<div class="flex items-center w-full md:w-fit gap-1 mt-1">
				{#each [
					{ id: VIEW_MODES.ABOUT, label: 'About', icon: Info },
					{ id: VIEW_MODES.RAW_DATA, label: 'Raw Data', icon: Database },
					{ id: VIEW_MODES.SUMMARY, label: 'Summary View', icon: BarChart },
					{ id: VIEW_MODES.TIME_ANALYSIS, label: 'Time Analysis', icon: Clock },
				] as option}
					<button 
						class={`px-2 py-1 text-xs rounded-none w-full md:w-fit md:h-fit h-10 border border-neutral transition-all flex items-center ${$viewMode === option.id ? 'bg-neutral text-white' : 'bg-base-100 text-neutral hover:bg-base-200'}`}
						on:click={() => setViewMode(option.id)}
					>
						<div class="flex items-center gap-1">
							<svelte:component this={option.icon} class="size-3" />
							{option.label}
						</div>
					</button>
				{/each}
			</div>
		</div>
	</header>
	
	<!-- Main Content -->
	<div class="flex-1 overflow-y-auto">
		<slot />
	</div>
	
	<footer class="mt-auto w-full pt-3 border-t border-neutral flex flex-col md:flex-row justify-between items-center">
		<div class="flex flex-col justify-between md:items-start items-center">
			<p class="text-[10px] text-neutral" style="font-family: var(--font-ui);">Data via <a href="https://github.com/Vonter/india-timeuse-survey" target="_blank" rel="noopener noreferrer" class="text-neutral font-semibold underline hover:text-purple transition-colors">India Time Use Survey</a>,</p>
			<p class="text-[10px] text-neutral" style="font-family: var(--font-ui);">
				Code available <a href="https://github.com/diagram-chasing/time-use-explorer" target="_blank" rel="noopener noreferrer" class="text-neutral font-semibold underline hover:text-purple transition-colors">on Github</a>
			</p>
		</div>

		<div class="flex flex-col md:px-0 px-4 md:my-0 my-4 md:flex-row items-center md:ml-auto md:text-right gap-2">
			<p class="text-[10px] text-center md:text-right text-neutral " style="font-family: var(--font-ui);">
				A project by Aman Bhargava and Vivek Matthew <br class="hidden md:block"/> for <a href="https://www.diagramchasing.fun" target="_blank" class="text-neutral font-semibold underline hover:text-purple transition-colors">Diagram Chasing</a>
			</p>
			<img src={DiagramChasingLogo} alt="Diagram Chasing Logo" class="md:size-7 size-12 rounded-sm border border-neutral" />
		</div>
	</footer>
</div>

<Toaster 
	position="bottom-center"
	theme="light"
	expand={false}
	closeButton={false}
	toastOptions={{
		unstyled: true,
		classes: {
			toast: "border border-neutral text-xs bg-base-100 p-2 w-[300px] flex items-center justify-center gap-2 shadow-sm",
			success: "border-green  bg-green text-white",
			error: "border-red bg-red text-white",
			loading: "border-blue fill-white bg-blue text-white",
			info: "border-blue bg-blue text-white",
			warning: "border-yellow bg-yellow text-white"
		}
	}}
/>

