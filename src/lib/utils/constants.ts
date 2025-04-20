// View modes
export const VIEW_MODES = {
  RAW_DATA: 'raw_data',
  SUMMARY: 'summary',
  TIME_ANALYSIS: 'time_analysis',
  ABOUT: 'about'
} as const;

// Define a type for view modes
export type ViewMode = typeof VIEW_MODES[keyof typeof VIEW_MODES];

// Column definitions
export const allColumns = [
  { id: 'state', label: 'State', type: 'string' },
  { id: 'district', label: 'District', type: 'string' },
  { id: 'gender', label: 'Gender', type: 'string' },
  { id: 'age', label: 'Age', type: 'number', formatType: 'standard', formatOptions: { decimals: 0 } },
  { id: 'marital_status', label: 'Marital Status', type: 'string' },
  { id: 'education', label: 'Education', type: 'string' },
  { id: 'religion', label: 'Religion', type: 'string' },
  { id: 'social_group', label: 'Social Group', type: 'string' },
  { id: 'household_size', label: 'Household Size', type: 'number', formatType: 'standard', formatOptions: { decimals: 0 } },
  { id: 'activity_code', label: 'Activity Code', type: 'string' },
  { id: 'activity_location', label: 'Activity Location', type: 'string' },
  { id: 'monthly_expenditure', label: 'Monthly Expenditure', type: 'number', formatType: 'compact', formatOptions: { decimals: 2 } },
  { id: 'industry', label: 'Industry', type: 'string' },
  { id: 'time', label: 'Time', type: 'time_range', hidden: true },
  { id: 'time_from', label: 'Time From', type: 'string' },
  { id: 'time_to', label: 'Time To', type: 'string' }
];

// Special columns for summary view
export const specialColumns = [
  { id: 'COUNT', label: 'Count Rows', type: 'function', formatType: 'standard', formatOptions: { decimals: 0 }, description: 'Count all rows (includes duplicate activities per person)' },
  { id: 'COUNT_DISTINCT_PERSON', label: 'Count People', type: 'function', formatType: 'standard', formatOptions: { decimals: 0 }, description: 'Count unique people using person_id' },
  { id: 'COUNT_DISTINCT', label: 'Count Unique Values', type: 'function', formatType: 'standard', formatOptions: { decimals: 0 }, description: 'Count distinct values in a column' },
  { id: 'AVG', label: 'Average', type: 'function', formatType: 'standard', formatOptions: { decimals: 2 } },
  { id: 'SUM', label: 'Sum', type: 'function', formatType: 'compact', formatOptions: { decimals: 2 } },
  { id: 'MIN', label: 'Minimum', type: 'function', formatType: 'standard', formatOptions: { decimals: 2 } },
  { id: 'MAX', label: 'Maximum', type: 'function', formatType: 'standard', formatOptions: { decimals: 2 } }
];

// Default selected columns
export const defaultSelectedColumns = ['gender', 'age', 'state', 'district', 'activity_code', 'education', 'time_from', 'time_to'];

// Default filters
export const defaultFilters = [
  // { column: 'age', operator: '=', value: '', enabled: true },
  // { column: 'gender', operator: '=', value: '', enabled: true },
  // { column: 'state', operator: '=', value: '', enabled: true }
];

// Default demographic columns for time analysis
export const defaultDemographicColumns = ['gender'];

// Default activity column for time analysis
export const defaultActivityColumn = 'activity_code';

// Default aggregations for summary view
export const defaultAggregations = [
  { column: '*', function: 'COUNT_DISTINCT_PERSON' }
];

// Default group by columns for summary view
export const defaultGroupByColumns: string[] = [];

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 100;
export const DEFAULT_CURRENT_PAGE = 1;

// Feature flags
export const FEATURES = {
  ENABLE_URL_STATE: true // Set to true to enable query state in URL
};





