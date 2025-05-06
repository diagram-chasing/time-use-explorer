<script lang="ts">
	import { Search, Download, BarChart, Clock, Link } from 'lucide-svelte';

	export let label: string;
	export let icon: 'search' | 'download' | 'chart' | 'clock' | 'link' = 'search';
	export let onClick: () => void | Promise<void>;
	export let disabled: boolean = false;
	export let loading: boolean = false;
	export let variant: 'primary' | 'secondary' = 'primary';

	// Local loading state for async handlers
	let isExecuting = false;

	// Handle click with async support
	async function handleClick() {
		if (disabled || loading || isExecuting) return;

		try {
			isExecuting = true;
			const result = onClick();

			// Check if onClick returned a promise
			if (result instanceof Promise) {
				await result;
			}
		} catch (error) {
			console.error('Error in button click handler:', error);
		} finally {
			isExecuting = false;
		}
	}

	// Determine the icon component to use
	let IconComponent: typeof Search | typeof Download | typeof BarChart | typeof Clock | typeof Link;

	$: {
		if (icon === 'search') IconComponent = Search;
		else if (icon === 'download') IconComponent = Download;
		else if (icon === 'chart') IconComponent = BarChart;
		else if (icon === 'clock') IconComponent = Clock;
		else if (icon === 'link') IconComponent = Link;
	}

	// Determine the classes to use
	$: buttonClasses =
		variant === 'primary'
			? 'bg-neutral text-white border-neutral hover:text-neutral hover:bg-yellow hover:border-neutral'
			: 'bg-base-100 text-neutral border-neutral hover:bg-base-200';
</script>

<button
	on:click={handleClick}
	disabled={disabled || loading || isExecuting}
	class="flex items-center justify-center gap-1 border px-3 py-1.5 text-xs transition-colors {buttonClasses} disabled:cursor-not-allowed disabled:opacity-50"
>
	{#if loading || isExecuting}
		<div
			class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
		></div>
	{:else}
		<svelte:component this={IconComponent} class="h-3 w-3" />
	{/if}
	{label}
</button>

<style>
	/* Custom styles */
	.btn-drop-shadow {
		box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.2);
	}
</style>
