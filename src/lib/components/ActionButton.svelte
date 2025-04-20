<script lang="ts">
  import { Search, Download, BarChart, Clock, Link } from 'lucide-svelte';
  
  export let label: string;
  export let icon: 'search' | 'download' | 'chart' | 'clock' | 'link' = 'search';
  export let onClick: () => void;
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let variant: 'primary' | 'secondary' = 'primary';
  
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
  $: buttonClasses = variant === 'primary' 
    ? 'bg-neutral text-white border-neutral hover:text-neutral hover:bg-yellow hover:border-neutral'
    : 'bg-base-100 text-neutral border-neutral hover:bg-base-200';
</script>

<button
  on:click={onClick}
  disabled={disabled || loading}
  class="px-3 py-1.5 text-xs flex items-center justify-center gap-1 border transition-colors {buttonClasses} disabled:opacity-50 disabled:cursor-not-allowed"
>
  {#if loading}
    <div class="w-3 h-3 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
  {:else}
    <svelte:component this={IconComponent} class="w-3 h-3" />
  {/if}
  {label}
</button>

<style>
  /* Custom styles */
  .btn-drop-shadow {
    box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.2);
  }
</style> 