import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: [
		vitePreprocess(), 
		mdsvex({
			extensions: ['.md', '.svx'],
			layout: {
				AboutLayout: './src/lib/components/mdsvex/AboutLayout.svelte'
			}
		})
	],
	kit: {
		adapter: adapter(),
		prerender: {
			handleHttpError: ({ path, referrer, message }) => {
				if (path === '/' && message.includes('duckdb')) {
					return;
				}

				throw new Error(`${path} - ${message}`);
			}
		}
	},
	extensions: ['.svelte', '.svx', '.md']
};

export default config;
