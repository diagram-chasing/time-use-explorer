// Import the DuckDB WASM files using Vite's ?url syntax
import duckdb_wasm_mvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { browser } from '$app/environment';
// Import parquet files as URLs
import sampleParquetUrl from '../assets/sample_1_perc.parquet?url';
import fullParquetUrl from '../assets/india_timeuse_survey.parquet?url';

// Import DuckDB types and functions
import { AsyncDuckDB, LogLevel, ConsoleLogger, DuckDBDataProtocol } from '@duckdb/duckdb-wasm';
import type { DuckDBBundles } from '@duckdb/duckdb-wasm';
import { notifications } from '$lib/utils/notificationUtils';

// Constants for persistence
const DB_INITIALIZED_KEY = 'duckdb_initialized';
const DB_VERSION_KEY = 'duckdb_version';
const CURRENT_DB_VERSION = '1.1'; // Increment this when schema changes

// Database singleton
let db: AsyncDuckDB | null = null;
let initPromise: Promise<AsyncDuckDB> | null = null;
// Track full dataset loading status
let isFullDatasetLoaded = false;
let onFullDatasetLoaded: (() => void) | null = null;
// Flag to prevent triggering full dataset load multiple times
let fullDatasetLoadingStarted = false;
let fullDatasetLoadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 3;
const MOBILE_DELAY_MS = 5000; // Longer delay for mobile

/**
 * Provides access to the global database instance
 * @returns The DuckDB instance or null if not initialized
 */
function getDatabase(): AsyncDuckDB | null {
  return db;
}

/**
 * Clear all DuckDB related localStorage entries
 */
function clearDuckDBCache(): void {
  if (!browser) return;
  
  console.log("Clearing DuckDB cache...");
  localStorage.removeItem(DB_INITIALIZED_KEY);
  localStorage.removeItem(DB_VERSION_KEY);
  
  // Also clear any IndexedDB databases if possible
  if ('indexedDB' in window) {
    try {
      const req = indexedDB.deleteDatabase('india_timeuse.db');
      req.onsuccess = () => console.log("Successfully deleted IndexedDB database");
      req.onerror = () => console.error("Error deleting IndexedDB database");
    } catch (e) {
      console.error("Error trying to delete IndexedDB database:", e);
    }
  }
}

/**
 * Initialize the DuckDB database
 * @returns Promise with the AsyncDuckDB instance
 */
async function initDuckDB(): Promise<AsyncDuckDB> {
  // Skip initialization during prerendering/SSR
  if (!browser) {
    console.log("Skipping DuckDB initialization in server/prerendering context");
    throw new Error("DuckDB cannot be initialized outside of a browser environment");
  }

  // Return existing instance or initialization promise if we already started
  if (db) return db;
  if (initPromise) return initPromise;
  
  // Check if database was previously initialized
  const hasCachedDB = browser && localStorage.getItem(DB_INITIALIZED_KEY) === 'true';
  const cachedVersion = browser ? localStorage.getItem(DB_VERSION_KEY) : null;
  const needsRebuild = cachedVersion !== CURRENT_DB_VERSION;
  
  if (hasCachedDB && needsRebuild) {
    console.log(`Database schema changed (${cachedVersion} → ${CURRENT_DB_VERSION}), rebuilding...`);
    clearDuckDBCache();
  }
  
  initPromise = (async () => {
    try {
      console.log(`Initializing DuckDB (${hasCachedDB && !needsRebuild ? 'from persistent storage' : 'new database'})...`);
      
      // Create logger for debugging
      const logger = new ConsoleLogger(LogLevel.INFO);
      
      // Import the actual DuckDB module (using dynamic import to ensure it runs only in browser)
      const duckdb = await import('@duckdb/duckdb-wasm');
      
     // Define bundles using new way to reference workers
const BUNDLES: DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm_mvp,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};
      
      // Select a bundle based on browser capabilities
      console.log("Selecting appropriate WASM bundle...");
      const bundle = await duckdb.selectBundle(BUNDLES);
      
      if (!bundle.mainModule || !bundle.mainWorker) {
        throw new Error('Failed to select appropriate WASM bundle for your browser.');
      }
      
      // Create worker - properly using local files instead of CDN URLs
      console.log(`Creating worker from local bundle...`);
      const worker = createCrossOriginWorker(bundle.mainWorker);
      
      // Create the database with the worker
      console.log("Creating DuckDB instance...");
      const duckdbInstance = new AsyncDuckDB(logger, worker);
      
      // Instantiate the database with the selected module
      console.log(`Instantiating DuckDB with local WASM module...`);
      await duckdbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker);
      
      // For this version, we'll use in-memory database instead of IndexedDB
      console.log("Opening in-memory database...");
      await duckdbInstance.open({
        path: ':memory:', // Use in-memory database
        query: {
          castTimestampToDate: false
        }
      });
      
      // Configure memory settings for better performance
      await configureDatabase(duckdbInstance);
      
      // Set up database with the sample data first for quick access
      await setupWithSampleData(duckdbInstance);
      
      // Store the database instance
      db = duckdbInstance;
      console.log("DuckDB initialization with sample data complete!");
      
      // Schedule the full dataset loading with a significant delay
      scheduleFullDatasetLoading(duckdbInstance);
      
      return duckdbInstance;
    } catch (error) {
      console.error("DuckDB initialization failed:", error);
      clearDuckDBCache();
      initPromise = null;
      throw error;
    }
  })();
  
  return initPromise;
}

/**
 * Schedule the loading of the full dataset with a significant delay
 */
function scheduleFullDatasetLoading(duckdbInstance: AsyncDuckDB): void {
  if (fullDatasetLoadingStarted) return;
  
  fullDatasetLoadingStarted = true;
  
  // Detect if mobile device for different timing
  const isMobile = browser && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const delay = isMobile ? MOBILE_DELAY_MS : 2000;
  
  console.log(`Scheduling full dataset loading in ${delay/1000} seconds... (${isMobile ? 'mobile' : 'desktop'} device detected)`);
  
  // Use a significant delay to ensure sample data is fully processed
  setTimeout(() => {
    console.log("Starting delayed full dataset loading...");
    notifications.fullDatasetLoading();
    loadFullDatasetInBackground(duckdbInstance).catch(error => {
      console.error("Background loading of full dataset failed:", error);
      
      // Reset flag to allow retry on page refresh
      fullDatasetLoadingStarted = false;
    });
  }, delay);
}

/**
 * Configure database settings for performance
 * @param duckdbInstance The DuckDB instance to configure
 */
async function configureDatabase(duckdbInstance: AsyncDuckDB): Promise<void> {
  const conn = await duckdbInstance.connect();
  
  try {
    // Memory settings
    await conn.query(`SET memory_limit='2GB'`);
    
    // Create temp directory
    if (browser) {
      await conn.query(`SET temp_directory='/duckdb_temp'`);
      console.log("Using browser-compatible temp directory: /duckdb_temp");
    } else {
      await conn.query(`SET temp_directory='/temp'`);
    }
    
    // Performance settings
    await conn.query(`SET threads=4`);
    await conn.query(`SET max_memory='1.5GB'`);
    await conn.query(`SET force_external=true`);
    
    // Verify settings
    const memResult = await conn.query(`SELECT current_setting('memory_limit') AS mem_limit`);
    console.log(`Memory limit set to: ${memResult.getChildAt(0)?.toArray()[0]}`);
  } catch (error) {
    console.error("Error configuring memory settings:", error);
  } finally {
    await conn.close();
  }
}

/**
 * Set up database with sample data for fast initial loading
 * @param duckdbInstance The DuckDB instance to set up
 */
async function setupWithSampleData(duckdbInstance: AsyncDuckDB): Promise<void> {
  // Register the sample Parquet file
  console.log("Registering sample Parquet file for quick loading...");
  
  // Notify users that sample data is being loaded
  if (browser) {
    notifications.info(`Loading sample dataset for quick preview...`);
  }
  
  if (browser) {
    // Register the file in the filesystem
    await duckdbInstance.registerFileURL(
      'india_timeuse_survey.parquet',
      sampleParquetUrl,
      DuckDBDataProtocol.HTTP,
      true
    );

  } else {
    console.warn("Not in browser environment, file registration skipped");
  }
  
  // Create views and tables using the sample data
  const conn = await duckdbInstance.connect();
  
  try {
    // Create view for parquet data
    await conn.query(`
      CREATE VIEW IF NOT EXISTS india_timeuse_survey AS 
      SELECT * FROM parquet_scan('india_timeuse_survey.parquet')
    `);
    console.log("Successfully created view over sample parquet data");
    
    // Create sample table - using the entire sample
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS india_timeuse_sample AS 
        SELECT * FROM parquet_scan('india_timeuse_survey.parquet')
      `);
      console.log("Created materialized sample table from sample data");
    } catch (error) {
      console.error("Error creating sample table:", error);
    }
    
    // Create utility functions
    await conn.query(`
      CREATE OR REPLACE FUNCTION time_diff_minutes(time_from, time_to) AS
      CASE 
        WHEN time_from IS NOT NULL AND time_to IS NOT NULL THEN
          CASE
            WHEN CAST('2000-01-01 ' || time_to AS TIMESTAMP) < CAST('2000-01-01 ' || time_from AS TIMESTAMP) THEN
              (EXTRACT(EPOCH FROM ((CAST('2000-01-02 ' || time_to AS TIMESTAMP) - CAST('2000-01-01 ' || time_from AS TIMESTAMP)))) / 60)::FLOAT
            ELSE
              (EXTRACT(EPOCH FROM ((CAST('2000-01-01 ' || time_to AS TIMESTAMP) - CAST('2000-01-01 ' || time_from AS TIMESTAMP)))) / 60)::FLOAT
          END
        ELSE NULL 
        END;
    `);
    
    // Create optimized views
    await conn.query(`
      CREATE OR REPLACE VIEW timeuse_by_gender_age AS
      SELECT 
        gender, 
        age, 
        activity_code,
        AVG(time_diff_minutes(time_from, time_to)) AS avg_minutes,
        COUNT(*) AS count
      FROM india_timeuse_survey
      GROUP BY gender, age, activity_code
    `);
    
    // Mark as initialized
    if (browser) {
      localStorage.setItem(DB_INITIALIZED_KEY, 'true');
      localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
      
      // Notify that sample data is loaded and ready
      notifications.datasetLoaded('sample');
    }
  } catch (error) {
    console.error("Error initializing database schema with sample data:", error);
    clearDuckDBCache();
    throw error;
  } finally {
    await conn.close();
  }
}

/**
 * Load the full dataset in the background
 * @param duckdbInstance The DuckDB instance to update
 */
async function loadFullDatasetInBackground(duckdbInstance: AsyncDuckDB): Promise<void> {
  fullDatasetLoadAttempts++;
  
  // Generate a unique filename for this attempt
  const uniqueFilename = `india_timeuse_survey_full_${Date.now()}_${fullDatasetLoadAttempts}.parquet`;
  
  try {
    console.log(`Starting background load of full dataset (attempt ${fullDatasetLoadAttempts})...`);
    
    if (browser) {
      try {
        console.log("Downloading full dataset file...");
        const response = await fetch(fullParquetUrl, {
          method: 'GET',
          cache: 'force-cache'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to download dataset: ${response.status} ${response.statusText}`);
        }
        
        // Get the file as an ArrayBuffer instead of Blob
        const fileBuffer = await response.arrayBuffer();
        const fileSize = fileBuffer.byteLength;
        
        if (fileSize < 4) {
          throw new Error(`Downloaded file is too small (${fileSize} bytes)`);
        }
        
        console.log(`File downloaded successfully (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
        
        // Register the file buffer directly with DuckDB
        console.log(`Registering file buffer with DuckDB as ${uniqueFilename}...`);
        await duckdbInstance.registerFileBuffer(
          uniqueFilename,
          new Uint8Array(fileBuffer)
        );
        
        // Yield to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const conn = await duckdbInstance.connect();
        
        try {
          // Verify we can query the file
          console.log("Testing full dataset accessibility...");
          try {
            const testResult = await conn.query(`SELECT COUNT(*) FROM parquet_scan('${uniqueFilename}') LIMIT 1`);
            console.log("Full dataset test query successful", testResult.toString());
            
            // Replace the view with the full dataset
            console.log("Updating database view to use full dataset...");
            await conn.query(`DROP VIEW IF EXISTS india_timeuse_survey`);
            await conn.query(`
              CREATE VIEW india_timeuse_survey AS 
              SELECT * FROM parquet_scan('${uniqueFilename}')
            `);
            
            console.log("Full dataset loaded and view updated successfully!");
            
            // Update cache settings
            const { cacheHelper } = await import('./cacheHelper');
            cacheHelper.setDatasetVersion('full');
            console.log("Clearing query cache to refresh data with full dataset...");
            cacheHelper.clearCache();
            
            // Set flag and notify listeners
            isFullDatasetLoaded = true;
            queueMicrotask(() => {
              if (onFullDatasetLoaded) {
                onFullDatasetLoaded();
              }
              
              // Use notification utility instead of direct event dispatch
              if (browser) {
                notifications.datasetLoaded('full');
              }
            });
          } catch (e) {
            console.error("Test query on full dataset failed:", e);
            
            // Only retry if we haven't exceeded max attempts
            if (fullDatasetLoadAttempts < MAX_LOAD_ATTEMPTS) {
              console.log(`Scheduling retry (${fullDatasetLoadAttempts}/${MAX_LOAD_ATTEMPTS})...`);
              setTimeout(() => {
                loadFullDatasetInBackground(duckdbInstance).catch(console.error);
              }, 3000);
            }
            
            throw new Error("Full dataset is not ready or accessible");
          }
        } finally {
          await conn.close();
        }
      } catch (e) {
        console.error("Failed to download and process full dataset:", e);
        
        // Only retry if we haven't exceeded max attempts
        if (fullDatasetLoadAttempts < MAX_LOAD_ATTEMPTS) {
          console.log(`Scheduling retry (${fullDatasetLoadAttempts}/${MAX_LOAD_ATTEMPTS})...`);
          setTimeout(() => {
            loadFullDatasetInBackground(duckdbInstance).catch(console.error);
          }, 3000);
        }
        
        throw e;
      }
    }
  } catch (error) {
    console.error(`Error loading full dataset (attempt ${fullDatasetLoadAttempts}):`, error);
    throw error;
  }
}

/**
 * Register a callback to be notified when the full dataset is loaded
 * @param callback Function to call when full dataset is loaded
 * @returns Boolean indicating if full dataset is already loaded
 */
function onFullDatasetReady(callback: () => void): boolean {
  if (isFullDatasetLoaded) {
    // Already loaded, call immediately
    setTimeout(callback, 0);
    return true;
  } else {
    // Will be called when loaded
    onFullDatasetLoaded = callback;
    return false;
  }
}

// Export functions for use in other modules
export const dbCore = {
  initDuckDB,
  getDatabase,
  clearDuckDBCache,
  onFullDatasetReady,
  isFullDatasetLoaded: () => isFullDatasetLoaded
};

function createCrossOriginWorker(workerUrl: string, options?: WorkerOptions): Worker {
  // In development mode, use the worker directly without the blob URL approach
  const isDev = import.meta.env?.DEV === true || import.meta.env?.MODE === 'development';
  
  if (isDev) {
    console.log('Development mode detected, using worker URL directly:', workerUrl);
    return new Worker(workerUrl, { type: "module", name: options?.name });
  }
  
  // Production mode: Create a blob with a module import statement
  const js = `import ${JSON.stringify(new URL(workerUrl, import.meta.url))}`;
  const blob = new Blob([js], { type: "application/javascript" });
  
  // Create an object URL for the blob
  const objURL = URL.createObjectURL(blob);
  
  // Create a worker from the object URL
  const worker = new Worker(objURL, { type: "module", name: options?.name });
  
  // Clean up the object URL when the worker has an error
  worker.addEventListener("error", () => {
    URL.revokeObjectURL(objURL);
  });
  
  return worker;
} 