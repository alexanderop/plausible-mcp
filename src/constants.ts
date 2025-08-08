export const plausibleApiUrl =
  process.env.PLAUSIBLE_API_URL ?? "https://plausible.io/api/v2";
export const plausibleApiKey = process.env.PLAUSIBLE_API_KEY;
export const debugStdio = process.env.DEBUG_STDIO === "true";

export const predefinedDateRanges = [
  "day", "7d", "28d", "30d", "91d", "month", "6mo", "12mo", "year", "all"
] as const;

export const validMetrics = [
  "visitors", "visits", "pageviews", "views_per_visit", "bounce_rate",
  "visit_duration", "events", "scroll_depth", "percentage", 
  "conversion_rate", "group_conversion_rate", "average_revenue", "total_revenue",
  "time_on_page"
] as const;

export const eventDimensions = [
  "event:goal", "event:page", "event:hostname"
] as const;

export const visitDimensions = [
  "visit:entry_page", "visit:exit_page", "visit:source", "visit:referrer", 
  "visit:channel", "visit:utm_medium", "visit:utm_source", "visit:utm_campaign", 
  "visit:utm_content", "visit:utm_term", "visit:device", "visit:browser", 
  "visit:browser_version", "visit:os", "visit:os_version", "visit:country", 
  "visit:region", "visit:city", "visit:country_name", "visit:region_name", 
  "visit:city_name"
] as const;

export const timeDimensions = [
  "time", "time:hour", "time:day", "time:week", "time:month"
] as const;

export const filterOperators = [
  "is", "is_not", "contains", "contains_not", "matches", "matches_not"
] as const;

export const logicalOperators = ["and", "or", "not"] as const;

export const behavioralOperators = ["has_done", "has_not_done"] as const;

export const metricsWithRequirements = {
  scroll_depth: { requires: 'event:page', type: 'filter or dimension' },
  percentage: { requires: 'dimensions', type: 'at least one dimension' },
  conversion_rate: { requires: 'event:goal', type: 'filter or dimension' },
  group_conversion_rate: { requires: 'event:goal', type: 'filter or dimension' },
  average_revenue: { requires: 'revenue goal', type: 'filter or dimension for revenue goal' },
  total_revenue: { requires: 'revenue goal', type: 'filter or dimension for revenue goal' },
  time_on_page: { requires: 'event:page', type: 'filter or dimension' }
} as const;

export const sessionMetrics = ['bounce_rate', 'views_per_visit', 'visit_duration'] as const;

// Type derived from sessionMetrics
export type SessionMetric = typeof sessionMetrics[number];