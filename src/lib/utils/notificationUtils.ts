import { browser } from '$app/environment';
import { formatNumber } from './formatUtils';

/**
 * Notification types supported by the application
 */
export enum NotificationType {
  ERROR = 'error',
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning'
}

/**
 * Notification categories to distinguish between technical and user-facing messages
 */
export enum NotificationCategory {
  USER = 'user',      // Errors that should be shown to users
  TECHNICAL = 'tech'  // Technical errors that should only be logged
}

/**
 * Notification data structure
 */
export interface NotificationData {
  message: string;
  type: NotificationType;
  category?: NotificationCategory;
  duration?: number;
}

/**
 * Centralized notification utility for the application
 * This provides a consistent way to trigger notifications
 * throughout the codebase.
 */
export const notifications = {
  /**
   * Dispatch notification event
   * @private
   */
  _notify(data: NotificationData): void {
    // Only send notifications to UI if they're user-facing
    if (browser && (data.category !== NotificationCategory.TECHNICAL)) {
      window.dispatchEvent(new CustomEvent('notification', {
        detail: data
      }));
    }
  },

  /**
   * Show an error notification
   * @param message - The error message to display
   * @param isTechnical - Whether this is a technical error that shouldn't be shown to users
   */
  error(message: string, isTechnical = false): void {
    console.error(message);
    this._notify({
      message,
      type: NotificationType.ERROR,
      category: isTechnical ? NotificationCategory.TECHNICAL : NotificationCategory.USER
    });
  },
  
  /**
   * Log a technical error that won't be shown to users
   * @param message - The technical error message
   */
  technicalError(message: string): void {
    console.error(message);
    // No UI notification, just console logging
    this._notify({
      message,
      type: NotificationType.ERROR,
      category: NotificationCategory.TECHNICAL
    });
  },
  
  /**
   * Show a success notification
   * @param message - The success message to display
   */
  success(message: string): void {
    console.log(message);
    this._notify({
      message,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.USER
    });
  },
  
  /**
   * Show an informational notification
   * @param message - The info message to display
   */
  info(message: string): void {
    console.log(message);
    this._notify({
      message,
      type: NotificationType.INFO,
      category: NotificationCategory.USER
    });
  },
  
  /**
   * Show a warning notification
   * @param message - The warning message to display
   */
  warning(message: string): void {
    console.warn(message);
    this._notify({
      message,
      type: NotificationType.WARNING,
      category: NotificationCategory.USER
    });
  },
  
  /**
   * Notify that the dataset has been loaded
   * @param datasetVersion - The version of the dataset
   */
  datasetLoaded(datasetVersion: string): void {
    if (datasetVersion === 'full') {
      this.success(`Full dataset loaded successfully!`);
    } else if (datasetVersion === 'sample') {
      this.info(`Sample dataset loaded - a 1% subset is available for immediate use`);
    }
  },
  
  /**
   * Notify that full dataset is being loaded in the background
   */
  fullDatasetLoading(): void {
    this.info(`Loading full dataset in the background...`);
  },
  
  /**
   * Notify that a query has completed
   * @param count - The number of results
   * @param type - The type of query (raw, summary, etc.)
   */
  queryCompleted(count: number, type: string): void {
    this.success(`Found ${formatNumber(count, {decimals: 0})} matching ${type === 'raw'  ? count === 1 ? 'row' : 'rows' : count === 1 ? 'result' : 'results'}`);
  },
  
  /**
   * Notify that data has been exported
   * @param type - The type of export (CSV, etc.)
   */
  dataExported(type: string): void {
    this.success(`${type} exported successfully`);
  },
  
  /**
   * Log a component error without showing it to the user
   * This is used for non-critical errors in UI components
   * @param componentName - The name of the component where the error occurred
   * @param error - The error that occurred
   */
  componentError(componentName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.technicalError(`Error in ${componentName}: ${errorMessage}`);
  }
}; 