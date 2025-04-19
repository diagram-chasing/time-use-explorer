<script context="module">
  import Card from '$lib/components/Card.svelte';
  
  // Export custom components for mdsvex
  export { Card as card }; 
</script>

<div class="markdown-content">
  <slot />
</div>

<style>
  .markdown-content {
    max-width: 100%;
    overflow: hidden;
  }

  .markdown-content :global(h1) {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    font-family: var(--font-ui);
    color: var(--color-neutral);
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-neutral);
  }
  
  .markdown-content :global(h2) {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-family: var(--font-ui);
    color: var(--color-neutral);
  }
  
  .markdown-content :global(h3) {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
    font-family: var(--font-ui);
    color: var(--color-neutral);
  }
  
  .markdown-content :global(p) {
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    font-family: var(--font-ui);
    color: var(--color-neutral);
    line-height: 1.4;
  }
  
  .markdown-content :global(a) {
    color: var(--color-neutral);
    text-decoration: underline;
    transition: color 0.2s;
  }
  
  .markdown-content :global(a:hover) {
    color: var(--color-purple);
  }
  
  .markdown-content :global(.bento-grid) {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2.75rem;
    margin: 0.75rem 0;
  }
  
  .markdown-content :global(.bento-grid > *) {
    display: flex;
    height: 100%;
  }
  
  .markdown-content :global(.card) {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
  
  .markdown-content :global(.card-body) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin-bottom: 0.75rem;
    padding-left: 1.25rem;
  }
  
  .markdown-content :global(li) {
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    font-family: var(--font-ui);
    color: var(--color-neutral);
  }
  
  .markdown-content :global(blockquote) {
    border-left: 3px solid var(--color-yellow);
    padding-left: 1rem;
    margin: 0.75rem 0;
    font-style: italic;
  }
  
  .markdown-content :global(code) {
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-size: 0.85em;
  }
  
  .markdown-content :global(pre) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.75rem;
    border-radius: 3px;
    overflow-x: auto;
    margin: 0.75rem 0;
    border: 1px solid var(--color-neutral);
  }
  
  @media (max-width: 640px) {
    .markdown-content :global(.about-container) {
      grid-template-columns: 1fr;
    }
    
    .markdown-content :global(.bento-grid) {
      grid-template-columns: 1fr;
    }
  }
</style> 