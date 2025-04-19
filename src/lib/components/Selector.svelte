<script lang="ts">
  export let type: 'button' | 'dropdown' = 'button';
  export let label: string = '';
  export let options: { id: string, label: string }[] = [];
  export let selectedValues: string[] = [];
  export let onChange: (value: string) => void = () => {};
  export let size: 'sm' | 'md' = 'md';
  
  // For dropdown type
  export let dropdownValue: string = '';
  export let dropdownOptions: { id: string, label: string }[] = [];
  export let onDropdownChange: (value: string) => void = () => {};
  
  $: sizeClasses = size === 'sm' ? 'text-xs py-1 px-2' : 'text-sm py-1.5 px-3';
</script>

{#if type === 'button'}
  {#if label}
    <div class="control-label">{label}</div>
  {/if}
  <div class="flex flex-wrap gap-1">
    {#each options as option}
    
      <button
        class="border border-neutral transition-colors {selectedValues.includes(option.id) ? 'bg-yellow text-neutral' : 'bg-base-100 text-neutral hover:bg-base-200'} {sizeClasses}"
        on:click={() => onChange(option.id)}
      >
        {option.label}
      </button>
    {/each}
  </div>
{:else if type === 'dropdown'}
  <select 
    class="control-input {sizeClasses}"
    bind:value={dropdownValue}
    on:change={() => onDropdownChange(dropdownValue)}
  >
    {#each dropdownOptions as option}
      <option value={option.id}>{option.label}</option>
    {/each}
  </select>
{/if} 