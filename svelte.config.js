import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: ['.md', '.svx']
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
