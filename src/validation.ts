import { sessionMetrics, predefinedDateRanges } from "./constants.js";
import { hasFilterForDimension } from "./filters.js";
import { ValidationError } from "./types.js";

import type { SessionMetric } from "./constants.js";
import type { FilterType, PlausibleQuery } from "./types.js";

// Validation functions for Plausible Analytics query parameters

export function validatePercentageMetric(
  metrics: Array<string>,
  dimensions?: Array<string>
): void {
  if (metrics.includes('percentage') && (dimensions === undefined || dimensions.length === 0)) {
    throw new ValidationError(
      `Metric 'percentage' requires dimensions`,
      `The 'percentage' metric calculates the percentage of visitors in each dimension group and requires at least one dimension to be specified.`
    );
  }
}

export function validatePageMetrics(
  metrics: Array<string>,
  dimensions?: Array<string>,
  filters?: Array<FilterType>
): void {
  const pageMetrics = metrics.filter(m => ['scroll_depth', 'time_on_page'].includes(m));
  if (pageMetrics.length > 0) {
    const hasPageDimension = dimensions?.some(d => d === 'event:page') ?? false;
    const hasPageFilter = hasFilterForDimension(filters, 'event:page');
    
    if (!hasPageDimension && !hasPageFilter) {
      throw new ValidationError(
        `Metrics ${pageMetrics.join(', ')} require event:page`,
        `These metrics require either an 'event:page' dimension or filter to calculate page-specific metrics.`
      );
    }
  }
}

export function validateGoalMetrics(
  metrics: Array<string>,
  dimensions?: Array<string>,
  filters?: Array<FilterType>
): void {
  const goalMetrics = metrics.filter(m => ['conversion_rate', 'group_conversion_rate'].includes(m));
  if (goalMetrics.length > 0) {
    const hasGoalDimension = dimensions?.some(d => d === 'event:goal') ?? false;
    const hasGoalFilter = hasFilterForDimension(filters, 'event:goal');
    
    if (!hasGoalDimension && !hasGoalFilter) {
      throw new ValidationError(
        `Metrics ${goalMetrics.join(', ')} require event:goal`,
        `These metrics require either an 'event:goal' dimension or filter. You need to set up goals in Plausible first.`
      );
    }
  }
}

export function validateRevenueMetrics(
  metrics: Array<string>,
  dimensions?: Array<string>,
  filters?: Array<FilterType>
): void {
  const revenueMetrics = metrics.filter(m => ['average_revenue', 'total_revenue'].includes(m));
  if (revenueMetrics.length > 0) {
    const hasGoalDimension = dimensions?.some(d => d === 'event:goal') ?? false;
    const hasGoalFilter = hasFilterForDimension(filters, 'event:goal');
    
    if (!hasGoalDimension && !hasGoalFilter) {
      throw new ValidationError(
        `Metrics ${revenueMetrics.join(', ')} require revenue goal`,
        `Revenue metrics require a revenue goal to be specified. Ensure you have revenue goals configured in Plausible and use an 'event:goal' dimension or filter.`
      );
    }
  }
}

export function validateMetricRequirements(
  metrics: Array<string>,
  dimensions?: Array<string>,
  filters?: Array<FilterType>
): void {
  validatePercentageMetric(metrics, dimensions);
  validatePageMetrics(metrics, dimensions, filters);
  validateGoalMetrics(metrics, dimensions, filters);
  validateRevenueMetrics(metrics, dimensions, filters);
}

export function validateSessionMetricsWithEventDimensions(
  metrics: Array<string>,
  dimensions?: Array<string>
): void {
  const hasSessionMetrics = metrics.some(m => sessionMetrics.includes(m as SessionMetric));
  const hasEventDimensions = dimensions?.some(d => 
    d.startsWith('event:') || d.startsWith('time:')
  ) ?? false;

  if (hasSessionMetrics && hasEventDimensions) {
    const sessionMetricsUsed = metrics.filter(m => sessionMetrics.includes(m as SessionMetric));
    const eventDimensionsUsed = dimensions?.filter(d => d.startsWith('event:')) ?? [];
    
    throw new ValidationError(
      'Session metrics cannot be mixed with event dimensions',
      `Session metrics (${sessionMetricsUsed.join(', ')}) calculate values per visit/session and cannot be used with event-level dimensions (${eventDimensionsUsed.join(', ')}). Use visit dimensions instead.`
    );
  }
}

export function validateTimeLabelRequirements(
  include?: PlausibleQuery['include'],
  dimensions?: Array<string>
): void {
  if (include?.time_labels === true) {
    const hasTimeDimension = dimensions?.some(d => d.startsWith('time')) ?? false;
    if (!hasTimeDimension) {
      throw new ValidationError(
        'time_labels requires a time dimension',
        'The time_labels option requires at least one time dimension (e.g., time, time:hour, time:day, time:week, time:month) to be included in the query.'
      );
    }
  }
}

export function validateDateRange(dateRange: string | [string, string]): void {
  if (typeof dateRange === 'string') {
    if (!predefinedDateRanges.includes(dateRange as typeof predefinedDateRanges[number])) {
      throw new ValidationError(
        `Invalid predefined date range: ${dateRange}`,
        `Must be one of: ${predefinedDateRanges.join(', ')}`
      );
    }
  } else if (Array.isArray(dateRange)) {
    if (dateRange.length !== 2) {
      throw new ValidationError(
        'Custom date range must have exactly 2 dates',
        'Provide [start_date, end_date] in ISO8601 format (YYYY-MM-DD)'
      );
    }
    // Validate ISO date format
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const [start, end] = dateRange;
    if (!isoDateRegex.test(start) || !isoDateRegex.test(end)) {
      throw new ValidationError(
        'Invalid date format in custom date range',
        'Dates must be in ISO8601 format (YYYY-MM-DD)'
      );
    }
  }
}

export function validateAllParameters(params: {
  site_id?: string;
  metrics?: Array<string>;
  date_range?: string | [string, string];
  dimensions?: Array<string>;
  filters?: Array<FilterType>;
  include?: PlausibleQuery['include'];
}): void {
  // Required parameters
  if (!params.site_id) {
    throw new ValidationError('site_id is required');
  }
  if (!params.metrics || params.metrics.length === 0) {
    throw new ValidationError('At least one metric is required');
  }
  if (!params.date_range) {
    throw new ValidationError('date_range is required');
  }

  // Validate date range
  validateDateRange(params.date_range);
  
  // Validate metric requirements
  validateMetricRequirements(params.metrics, params.dimensions, params.filters);
  
  // Validate session metrics with event dimensions
  validateSessionMetricsWithEventDimensions(params.metrics, params.dimensions);
  
  // Validate time labels
  validateTimeLabelRequirements(params.include, params.dimensions);
}