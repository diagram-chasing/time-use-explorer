<script lang="ts">
    // SEO component for managing meta tags
    export let title = 'India Time Use Survey Explorer | Diagram Chasing';
    export let description = 'Explore, subset and summarize the India Time Use Survey data in your browser';
    export let keywords = 'india time use survey, diagram chasing, data visualization, social science, india';
    export let url = '';
    export let siteUrl = 'https://india-time-use-explorer.netlify.app'; 
    
  
    import { page } from '$app/stores';
    
    // Calculate the absolute URL for images - ensuring no double slashes or periods
    $: isPrerendering = $page.url.origin.includes('sveltekit-prerender');
    $: canonicalUrl = url || (isPrerendering ? `${siteUrl}${$page.url.pathname}` : $page.url.href);
  </script>
  
  <svelte:head>
    <!-- Primary Meta Tags -->
    <title>{title}</title>
    <meta name="title" content={title} />
    <meta name="description" content={description} />
    <meta name="keywords" content={keywords} />
    <link rel="icon" href="https://india-time-use-explorer.netlify.app/favicon.ico" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content="https://india-time-use-explorer.netlify.app/sharecard.jpg" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content={canonicalUrl} />
    <meta property="twitter:title" content={title} />
    <meta property="twitter:description" content={description} />
    <meta property="twitter:image" content="https://india-time-use-explorer.netlify.app/sharecard.jpg" />
    
    <!-- Additional Meta Tags -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#60473d" />
    <meta name="author" content="Diagram Chasing" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href={canonicalUrl} />
  </svelte:head> 