<script lang="ts">
	import '../app.css';
	import { fly, fade } from 'svelte/transition';
	import { Database, BarChart, Clock, Info } from 'lucide-svelte';
	import { Toaster, toast } from 'svelte-sonner';
	import DiagramChasingLogo from '$lib/assets/dc-logo-no-text.png';
	import Logo from '$lib/assets/logo.webp';
	import { VIEW_MODES } from '$lib/utils/constants';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { setAppContext } from '$lib/utils/context';
  import { NotificationType, type NotificationData, notifications } from '$lib/utils/notificationUtils';
  
  // Set up the context for all children components to use
  const context = setAppContext();
  const { viewMode, setViewMode } = context;
  
  // Initialize DuckDB when the component mounts
  onMount(async () => {
    if (browser) {
      await context.initializeDuckDB();
      
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

