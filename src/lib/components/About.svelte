<script lang="ts">
  import AboutContent from '$lib/content/about.svx';
</script>

<div class="about-container ">
  <div class="bg-base-100 h-full overflow-y-auto border border-neutral p-3">
    <AboutContent />
  </div>
</div>

<style>
  .about-container {
    height: calc(96svh - 7.8rem);
    
  }

  @media (max-width: 769px) {
    .about-container {
      height: 100%;
    }
  }
</style> 