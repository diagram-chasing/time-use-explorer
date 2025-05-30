<script lang="ts">
	import { fade } from 'svelte/transition';
	import { X, AlertCircle, Check, AlertOctagon } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';

	// Props
	export let title: string;
	export let message: string;
	export let type: 'info' | 'warning' | 'error' = 'info';
	export let visible: boolean = false;
	export let confirmLabel: string = 'Confirm';
	export let cancelLabel: string = 'Cancel';
	export let showCancel: boolean = true;

	// Event handling
	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
		close: void;
	}>();

	// Close modal and dispatch event
	function close() {
		dispatch('close');
	}

	// Confirm action and close
	function confirm() {
		dispatch('confirm');
		close();
	}

	// Cancel action and close
	function cancel() {
		dispatch('cancel');
		close();
	}

	// Handle backdrop click
	function handleBackdropClick(event: MouseEvent) {
		// Only close if clicking the backdrop directly, not the modal content
		if (event.target === event.currentTarget) {
			cancel();
		}
	}

	// Handle keydown events for accessibility
	function handleKeydown(event: KeyboardEvent) {
		if (!visible) return;

		if (event.key === 'Escape') {
			cancel();
		} else if (event.key === 'Enter') {
			confirm();
		}
	}

	// Get the icon and colors based on the modal type
	$: typeIcon = type === 'error' ? AlertOctagon : type === 'warning' ? AlertCircle : Check;

	$: typeColor = type === 'error' ? 'text-red' : type === 'warning' ? 'text-red' : 'text-blue';

	$: typeColorBg =
		type === 'error' ? 'border-red' : type === 'warning' ? 'border-yellow' : 'border-blue';
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<!-- Modal backdrop -->
	<div
		class="bg-neutral/50 fixed inset-0 z-50 flex items-center justify-center"
		transition:fade={{ duration: 150 }}
		on:click={handleBackdropClick}
	>
		<!-- Modal container -->
		<div
			class="bg-base-100 border-neutral relative mx-4 w-full max-w-md border shadow-sm"
			transition:fade={{ duration: 150, delay: 50 }}
		>
			<!-- Modal header -->
			<div class="border-neutral bg-base-200 flex items-center justify-between border-b p-3">
				<h3 class="{typeColor} flex items-center gap-2 text-xs font-bold uppercase">
					<svelte:component this={typeIcon} class="h-3 w-3 {typeColor}" />
					{title}
				</h3>
				<button
					class="text-neutral hover:text-base-300 transition-colors"
					on:click={cancel}
					aria-label="Close modal"
				>
					<X class="h-3 w-3" />
				</button>
			</div>

			<!-- Modal content -->
			<div class="modal p-4">
				<div class="text-xs" style="font-family: var(--font-ui);">
					{@html message}
				</div>
			</div>

			<!-- Modal footer -->
			<div class="border-neutral flex justify-end gap-2 border-t p-3">
				{#if showCancel}
					<button
						class="border-neutral bg-base-100 hover:bg-base-200 border px-3 py-1.5 text-xs transition-colors"
						on:click={cancel}
					>
						{cancelLabel}
					</button>
				{/if}
				<button
					class="border-neutral bg-neutral hover:bg-blue hover:border-blue border px-3 py-1.5 text-xs text-white transition-colors"
					on:click={confirm}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global {
		.modal a {
			color: var(--color-blue);
			text-decoration: underline;
		}
	}
</style>
