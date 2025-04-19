import * as d3 from 'd3';

// Format types
export type NumberFormatType = 'standard' | 'lakhs' | 'millions' | 'billions' | 'compact' | 'percentage' ;

// Format options
export interface NumberFormatOptions {
  type: NumberFormatType;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  useCommas?: boolean;
  locale?: string;
}

// Default format options
const defaultOptions: NumberFormatOptions = {
  type: 'standard',
  decimals: 2,
  useCommas: true,
  locale: 'en-IN'
};

// Scale definitions for different format types
const scaleDefinitions = {
  standard: { scale: 1, suffix: '' },
  lakhs: { scale: 1e5, suffix: ' L' },
  millions: { scale: 1e6, suffix: ' M' },
  billions: { scale: 1e9, suffix: ' B' },
  percentage: { scale: 100, suffix: '%' },
  // Compact is handled specially
};

/**
 * Creates a D3 formatter based on the provided options
 * @param options Formatting options
 * @returns A D3 formatter function
 */
export function createNumberFormatter(options: Partial<NumberFormatOptions> = {}): (value: number) => string {
  // Merge with default options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Create base formatter with locale
  const locale = d3.formatLocale({
    decimal: '.',
    thousands: ',',
    grouping: [3],
    currency: ['₹', ''],
    percent: '%'
  });
  
  // Create the appropriate formatter based on type
  if (mergedOptions.type === 'compact') {
    return (value: number) => {
      // Determine the appropriate scale based on value
      let scale, scaleSuffix;
      
      if (value >= 1e9) {
        scale = 1e9;
        scaleSuffix = ' B';
      } else if (value >= 1e6) {
        scale = 1e6;
        scaleSuffix = ' M';
      } else if (value >= 1e5) {
        scale = 1e5;
        scaleSuffix = ' L';
      } else if (value >= 1e3) {
        scale = 1e3;
        scaleSuffix = ' K';
      } else {
        scale = 1;
        scaleSuffix = '';
      }
      
      // Format with appropriate scale
      const scaled = value / scale;
      const format = scale === 1 && Number.isInteger(value) ? ',' : `,.${mergedOptions.decimals}f`;
      const formatted = locale.format(format)(scaled);
      
      return `${mergedOptions.prefix || ''}${formatted}${mergedOptions.suffix || scaleSuffix}`;
    };
  } else {
    // Get scale definition
    const definition = scaleDefinitions[mergedOptions.type] || scaleDefinitions.standard;
    
    return (value: number) => {
      // Only scale if the value is large enough (except for percentage)
      const shouldScale = mergedOptions.type === 'percentage' || value >= definition.scale;
      const scaledValue = shouldScale ? value / definition.scale : value;
      
      // Use integer format if the value is an integer and no decimals specified
      const format = Number.isInteger(scaledValue) && mergedOptions.decimals === 0 
        ? ',' 
        : `,.${mergedOptions.decimals}f`;
      
      const formatted = locale.format(format)(scaledValue);
      const suffix = shouldScale ? (mergedOptions.suffix || definition.suffix) : '';
      
      return `${mergedOptions.prefix || ''}${formatted}${suffix}`;
    };
  }
}

/**
 * Format a number using the specified options
 * @param value The number to format
 * @param options Formatting options
 * @returns Formatted string
 */
export function formatNumber(value: number, options: Partial<NumberFormatOptions> = {}): string {
  const formatter = createNumberFormatter(options);
  return formatter(value);
}

/**
 * Helper functions for common formatting cases
 * Each uses the base formatNumber function with specific options
 */

export function formatLakhs(value: number, decimals: number = 2): string {
  return formatNumber(value, { type: 'lakhs', decimals });
}

export function formatMillions(value: number, decimals: number = 2): string {
  return formatNumber(value, { type: 'millions', decimals });
}

export function formatBillions(value: number, decimals: number = 2): string {
  return formatNumber(value, { type: 'billions', decimals });
}

export function formatCompact(value: number, decimals: number = 2): string {
  return formatNumber(value, { type: 'compact', decimals });
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return formatNumber(value, { type: 'percentage', decimals });
}

