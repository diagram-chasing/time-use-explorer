<script lang="ts">
	import Seo from '$lib/components/SEO.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Results from '$lib/components/Results.svelte';
	import About from '$lib/components/About.svelte';
	import VisualizationPanel from '$lib/components/VisualizationPanel.svelte';
	import { notifications } from '$lib/utils/notificationUtils';
	import { getAppContext, exportConfirmDialog } from '$lib/utils/context';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { VIEW_MODES } from '$lib/utils/constants';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	const { viewMode } = getAppContext();

	function handleComponentError(component: string, error: unknown): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		notifications.technicalError(`${component} error: ${errorMessage}`);
	}

	// Handle modal confirm/cancel events
	function handleConfirmExport() {
		if ($exportConfirmDialog.onConfirm) {
			$exportConfirmDialog.onConfirm();
		}

		// Close the dialog
		exportConfirmDialog.update((dialog) => ({
			...dialog,
			visible: false
		}));
	}

	function handleCancelExport() {
		// Just close the dialog
		exportConfirmDialog.update((dialog) => ({
			...dialog,
			visible: false
		}));
	}
</script>

<Seo />

<div class="grid h-full grid-cols-1 gap-4 overflow-y-clip lg:grid-cols-4">
	{#if $viewMode !== VIEW_MODES.ABOUT}
		<!-- Sidebar on the left column -->
		<div class="flex flex-col gap-4 lg:h-[calc(96svh-6.2rem)]">
			<div class="h-1/2 flex-1">
				<svelte:boundary
					onerror={(error: unknown, reset: () => void) => handleComponentError('Sidebar', error)}
				>
					<Sidebar />

					{#snippet failed(error, reset)}
						<div class="bg-base-200 rounded-md p-4 text-sm">
							<p class="mb-2">Filter panel could not be displayed</p>
							<button class="bg-neutral rounded-sm px-2 py-1 text-xs text-white" on:click={reset}>
								Try again
							</button>
						</div>
					{/snippet}
				</svelte:boundary>
			</div>
			<!-- Visualization panel under sidebar on desktop only -->
			{#if $viewMode !== VIEW_MODES.ABOUT && $viewMode !== VIEW_MODES.RAW_DATA}
				<div class="mb-4 hidden h-1/2 flex-1 lg:block">
					<VisualizationPanel />
				</div>
			{:else}
				<div class="-z-1 mb-4 hidden h-1/2 flex-1 lg:block"></div>
			{/if}
		</div>

		<!-- Results on the right column -->
		<div class="h-full lg:col-span-3">
			<Results />
		</div>
	{:else}
		<!-- About view takes full width -->
		<div class="mb-4 h-full lg:col-span-4">
			<About />
		</div>
	{/if}
</div>

<!-- Export confirmation modal -->
<ConfirmModal
	visible={$exportConfirmDialog.visible}
	title={$exportConfirmDialog.title}
	message={$exportConfirmDialog.message}
	type={$exportConfirmDialog.type}
	confirmLabel="Export"
	cancelLabel="Cancel"
	on:confirm={handleConfirmExport}
	on:cancel={handleCancelExport}
/>
