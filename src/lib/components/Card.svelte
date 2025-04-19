<script>
  export let image = '';
</script>

<div class="card bg-base-100 transition-all h-full">
  <div class="card-body flex flex-col h-full">
    <div class="flex flex-col flex-grow">
      <div class="content flex-grow">
        <slot />
      </div>
      
      {#if image}
        <div class="image-container mt-auto overflow-hidden border border-neutral p-1">
          <img src={image} alt="Feature" class="w-full object-cover" />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .card, .card-body {
    display: flex;
    flex-direction: column;
  }
  
  .image-container {
    margin-top: auto;
  }
</style>