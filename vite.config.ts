import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rollupOptions: {
			output: {
				assetFileNames: (assetInfo) => {
					// Apply special naming for parquet files to improve caching
					if (assetInfo.name && assetInfo.name.endsWith('.parquet')) {
						return 'assets/parquet/[name].[hash][extname]';
					}
					return 'assets/[name].[hash][extname]';
				}
			}
		}
	},
	server: {
		fs: {
			strict: false
		}
	},
	optimizeDeps: {
		exclude: ['*.parquet']
	}
});
