#!/usr/bin/env node

import { inspect } from "util";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  plausibleApiUrl,
  plausibleApiKey,
  debugStdio,
  predefinedDateRanges,
  validMetrics,
  eventDimensions,
  visitDimensions,
  timeDimensions,
  filterOperators,
  logicalOperators,
  behavioralOperators,
  sessionMetrics,
} from "./constants.js";

import type { SessionMetric } from "./constants.js";

if (plausibleApiKey === undefined || plausibleApiKey === "") {
  throw new Error("PLAUSIBLE_API_KEY environment variable is required");
}


// Type definitions for query parameters
type PlausibleQuery = {
  site_id: string;
  metrics: Array<string>;
  date_range: string | [string, string];
  dimensions?: Array<string>;
  filters?: Array<SimpleFilter | LogicalFilter | BehavioralFilter | SegmentFilter>;
  order_by?: Array<[string, "asc" | "desc"]>;
  include?: {
    imports?: boolean;
    time_labels?: boolean;
    total_rows?: boolean;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
}

// Validation error class
class ValidationError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}


// Validation functions
function validatePercentageMetric(
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

function validatePageMetrics(
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

function validateGoalMetrics(
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

function validateRevenueMetrics(
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

function validateMetricRequirements(
  metrics: Array<string>,
  dimensions?: Array<string>,
  filters?: Array<FilterType>
): void {
  validatePercentageMetric(metrics, dimensions);
  validatePageMetrics(metrics, dimensions, filters);
  validateGoalMetrics(metrics, dimensions, filters);
  validateRevenueMetrics(metrics, dimensions, filters);
}

function validateSessionMetricsWithEventDimensions(
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

function validateTimeLabelRequirements(
  include?: PlausibleQuery['include'],
  dimensions?: Array<string>
): void {
  if (include?.time_labels === true) {
    const hasTimeDimension = (dimensions ?? []).some(d => 
      d === 'time' || d.startsWith('time:')
    );
    
    if (!hasTimeDimension) {
      throw new ValidationError(
        'time_labels requires a time dimension',
        `The 'include.time_labels' option requires a time dimension (e.g., 'time', 'time:day', 'time:hour') to generate time labels.`
      );
    }
  }
}

function validateDateRange(dateRange: string | [string, string]): void {
  if (Array.isArray(dateRange)) {
    const [start, end] = dateRange;
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError(
        'Invalid date format in date range',
        'Custom date ranges must be in ISO8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss+TZ:TZ)'
      );
    }
    
    if (startDate >= endDate) {
      throw new ValidationError(
        'Invalid date range',
        `Start date (${start}) must be before end date (${end})`
      );
    }
  }
}

// Helper to check simple filter
function checkSimpleFilter(filter: SimpleFilter, dimension: string): boolean {
  return filter[1] === dimension;
}

// Helper to check behavioral filter
function checkBehavioralFilter(filter: BehavioralFilter, dimension: string): boolean {
  return filter[1][1] === dimension;
}

// Helper to check single filter
function checkSingleFilter(filter: FilterType, dimension: string): boolean {
  const operator = filter[0];
  
  if (operator === 'and' || operator === 'or') {
    return hasFilterForDimension(filter[1], dimension);
  }
  
  if (operator === 'not') {
    return hasFilterForDimension([filter[1]] as Array<FilterType>, dimension);
  }
  
  if (operator === 'has_done' || operator === 'has_not_done') {
    return checkBehavioralFilter(filter, dimension);
  }
  
  if (operator === 'is' && filter[1] === 'segment') {
    return false; // Skip segment filters
  }
  
  // Simple filter
  return checkSimpleFilter(filter as SimpleFilter, dimension);
}

// Helper function to check if filters contain a specific dimension
function hasFilterForDimension(
  filters: Array<FilterType> | undefined,
  dimension: string
): boolean {
  if (filters === undefined || filters.length === 0) return false;
  
  return filters.some(filter => checkSingleFilter(filter, dimension));
}

// Validate all parameters and return error if any
function validateAllParameters(params: {
  metrics: Array<string>;
  dimensions: Array<string> | undefined;
  filters: Array<FilterType> | undefined;
  include: PlausibleQuery['include'] | undefined;
  dateRange: string | [string, string];
}): ValidationError | null {
  const { metrics, dimensions, filters, include, dateRange } = params;
  try {
    validateDateRange(dateRange);
    validateMetricRequirements(metrics, dimensions, filters);
    validateSessionMetricsWithEventDimensions(metrics, dimensions);
    validateTimeLabelRequirements(include, dimensions);
    return null;
  } catch (error) {
    if (error instanceof ValidationError) {
      return error;
    }
    throw error;
  }
}

// Execute the query and handle errors
async function executeQuery(query: PlausibleQuery & {
  dimensions?: Array<string>;
  filters?: Array<FilterType>;
  order_by?: Array<[string, "asc" | "desc"]>;
  include?: PlausibleQuery["include"];
  pagination?: PlausibleQuery["pagination"];
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const { dimensions, filters, order_by: orderBy, include, pagination, ...baseQuery } = query;
  
  const fullQuery: PlausibleQuery = baseQuery;
  if (dimensions !== undefined) fullQuery.dimensions = dimensions;
  if (filters !== undefined) fullQuery.filters = filters;
  if (orderBy !== undefined) fullQuery.order_by = orderBy;
  if (include !== undefined) fullQuery.include = include;
  if (pagination !== undefined) fullQuery.pagination = pagination;
  
  try {
    const response = await plausibleClient.query(fullQuery);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error querying Plausible API: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

type SimpleFilter = [
  typeof filterOperators[number],
  string,
  Array<string>,
  { case_sensitive?: boolean }?
];

type LogicalFilter = [
  typeof logicalOperators[number],
  Array<SimpleFilter | LogicalFilter | BehavioralFilter | SegmentFilter>
];

type BehavioralFilter = [
  typeof behavioralOperators[number],
  SimpleFilter
];

type SegmentFilter = ["is", "segment", Array<number>];

// Plausible API client
class PlausibleClient {
  async query(query: PlausibleQuery): Promise<unknown> {
    const response = await fetch(`${plausibleApiUrl}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${plausibleApiKey ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`Plausible API error: ${response.statusText}`);
    }

    return response.json();
  }
}

const plausibleClient = new PlausibleClient();

// Create and configure the MCP server
const server = new McpServer(
  {
    name: "plausible-mcp",
    version: "0.0.1",
  },
  {
    instructions: "Use this server to query analytics data from Plausible Analytics API.",
  }
);

// Define ISO date validation for reuse
const isoDate = z.string().regex(
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})?$/,
  "Date must be in ISO8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss+TZ:TZ)"
);

// Use array with length constraint instead of tuple
const datePair = z
  .array(isoDate)
  .length(2)
  .refine((dates): dates is [string, string] => {
    const [start, end] = dates;
    return start !== undefined && end !== undefined && new Date(start) < new Date(end);
  }, {
    message: "Start date must be before end date",
  });

// Define dimension schema
const dimensionSchema = z.union([
  z.enum(eventDimensions),
  z.enum(visitDimensions),
  z.enum(timeDimensions),
  z.string().regex(/^event:props:/, "Custom properties must start with 'event:props:'")
]).describe("Dimension to group data by");

// Define filter schemas
const simpleFilterSchema = z.union([
  z.tuple([
    z.enum(filterOperators),
    z.string(),
    z.array(z.string()),
  ]),
  z.tuple([
    z.enum(filterOperators),
    z.string(),
    z.array(z.string()),
    z.object({ case_sensitive: z.boolean().optional() })
  ])
]);

const segmentFilterSchema = z.tuple([
  z.literal("is"),
  z.literal("segment"),
  z.array(z.number())
]);

// Recursive type for logical filters
type FilterType = SimpleFilter | LogicalFilter | BehavioralFilter | SegmentFilter;

const filterSchema: z.ZodType<FilterType> = z.lazy(() => 
  z.union([
    simpleFilterSchema,
    segmentFilterSchema,
    z.tuple([
      z.enum(logicalOperators),
      z.array(filterSchema)
    ]),
    z.tuple([
      z.enum(behavioralOperators),
      simpleFilterSchema
    ])
  ])
);

// Register the plausible_query tool
server.tool(
  "plausible_query",
  `Query analytics data from Plausible

This tool allows you to fetch various metrics from Plausible Analytics for a given site and date range with advanced filtering, grouping, and analysis capabilities.

METRICS:
• visitors - The number of unique visitors
• visits - The number of visits/sessions
• pageviews - The number of pageview events
• views_per_visit - The number of pageviews divided by the number of visits (⚠️ Cannot be used with event dimensions)
• bounce_rate - Bounce rate percentage (⚠️ Cannot be used with event dimensions)
• visit_duration - Visit duration in seconds (⚠️ Cannot be used with event dimensions)
• events - The number of events (pageviews + custom events)
• scroll_depth - Page scroll depth averaged per session (⚠️ REQUIRES event:page filter or dimension)
• percentage - The percentage of visitors of total who fall into this category (⚠️ REQUIRES at least one dimension)
• conversion_rate - The percentage of visitors who completed the goal (⚠️ REQUIRES event:goal filter or dimension)
• group_conversion_rate - The percentage of visitors who completed the goal with the same dimension (⚠️ REQUIRES event:goal filter or dimension)
• average_revenue - Average revenue per revenue goal conversion (⚠️ REQUIRES revenue goal filter or dimension)
• total_revenue - Total revenue from revenue goal conversions (⚠️ REQUIRES revenue goal filter or dimension)
• time_on_page - Average time in seconds spent on a page per visit (⚠️ REQUIRES event:page filter or dimension)

DIMENSIONS for grouping:
• Event: event:goal, event:page, event:hostname, event:props:<custom_prop>
• Visit: visit:entry_page, visit:exit_page, visit:source, visit:referrer, visit:channel, visit:utm_medium, visit:utm_source, visit:utm_campaign, visit:utm_content, visit:utm_term, visit:device, visit:browser, visit:browser_version, visit:os, visit:os_version, visit:country, visit:region, visit:city, visit:country_name, visit:region_name, visit:city_name
• Time: time, time:hour, time:day, time:week, time:month

FILTER operators:
• Simple: is, is_not, contains, contains_not, matches, matches_not
• Logical: and, or, not
• Behavioral: has_done, has_not_done (filter sessions by whether they contain specific events)
• Segments: ["is", "segment", [segment_id]]

IMPORTANT RESTRICTIONS:
• Session metrics (bounce_rate, views_per_visit, visit_duration) CANNOT be mixed with event dimensions
• Time dimensions CANNOT be used in filters
• include.time_labels REQUIRES a time dimension

EXAMPLES:
1. Simple traffic query:
   { "site_id": "example.com", "metrics": ["visitors", "pageviews"], "date_range": "7d" }

2. Country breakdown with filters:
   { "site_id": "example.com", "metrics": ["visitors"], "date_range": "30d", 
     "dimensions": ["visit:country_name"], 
     "filters": [["is", "visit:device", ["Mobile", "Tablet"]]] }

3. Goal conversion by source:
   { "site_id": "example.com", "metrics": ["conversion_rate"], "date_range": "month",
     "dimensions": ["visit:source"],
     "filters": [["is", "event:goal", ["Signup"]]] }

4. Time series with behavioral filter:
   { "site_id": "example.com", "metrics": ["visitors"], "date_range": "7d",
     "dimensions": ["time:day"],
     "filters": [["has_done", ["is", "event:page", ["/pricing"]]]] }`,
  {
    site_id: z
      .string()
      .min(1, "Site ID cannot be empty")
      .describe("The domain of the site to query data for"),
    metrics: z
      .array(z.enum(validMetrics))
      .min(1, "At least one metric is required")
      .describe("Array of metrics to fetch. Choose from the valid metrics listed in the tool description."),
    date_range: z
      .union([
        z.enum(predefinedDateRanges).describe("Predefined date range"),
        datePair.describe("Custom date range as [start_date, end_date]")
      ])
      .describe(`Date range to query. Either a predefined range (${predefinedDateRanges.join(", ")}) or custom date range as [start_date, end_date] in ISO8601 format`),
    dimensions: z
      .array(dimensionSchema)
      .optional()
      .describe("List of dimensions to group data by. Can be event, visit, time dimensions, or custom properties (event:props:property_name)"),
    filters: z
      .array(filterSchema)
      .optional()
      .describe("Array of filters to limit which events or sessions are included. Supports simple filters (with optional case_sensitive modifier), logical operations (and/or/not), behavioral filters, and segments. Example: [\"contains\", \"visit:country\", [\"united\"], {\"case_sensitive\": false}]"),
    order_by: z
      .array(z.tuple([
        z.string().describe("Dimension or metric name"),
        z.enum(["asc", "desc"]).describe("Sort direction")
      ]))
      .optional()
      .describe("Custom ordering of results. Each tuple contains [dimension_or_metric, direction]"),
    include: z
      .object({
        imports: z.boolean().optional().describe("Include imported data in results"),
        time_labels: z.boolean().optional().describe("Include all time labels for date range (requires time dimension)"),
        total_rows: z.boolean().optional().describe("Include total row count for pagination")
      })
      .optional()
      .describe("Additional options for what data to include in the response"),
    pagination: z
      .object({
        limit: z.number().optional().default(10000).describe("Number of results to return (default: 10000)"),
        offset: z.number().optional().default(0).describe("Number of results to skip (default: 0)")
      })
      .optional()
      .describe("Pagination options for large result sets")
  },
  async (params) => {
    // Type assertions for params
    const siteId = params.site_id;
    const metrics = params.metrics as Array<string>;
    const dateRange = params.date_range as string | [string, string];
    const dimensions = params.dimensions;
    const filters = params.filters;
    const orderBy = params.order_by;
    const include = params.include as PlausibleQuery["include"] | undefined;
    const pagination = params.pagination as PlausibleQuery["pagination"] | undefined;

    // Validate all parameters
    const validationError = validateAllParameters({ metrics, dimensions, filters, include, dateRange });
    if (validationError !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Parameter validation error: ${validationError.message}\n\n${validationError.details ?? ''}`,
          },
        ],
      };
    }

    // Build and execute query
    return executeQuery({
      site_id: siteId,
      metrics,
      date_range: dateRange,
      dimensions,
      filters,
      order_by: orderBy,
      include,
      pagination
    });
  }
);





// Debug logging helper
function debugLog(category: string, message: string, data?: unknown): void {
  if (!debugStdio) return;
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [SERVER] [${category}] ${message}`;
  console.error(logMessage);
  if (data !== undefined) {
    console.error("  DATA:", inspect(data, { depth: 3, colors: true }));
  }
}

// Main function to start the server
async function main(): Promise<void> {
  debugLog("LIFECYCLE", "Starting MCP server", {
    pid: process.pid,
    nodeVersion: process.version,
    debugEnabled: debugStdio
  });

  const transport = new StdioServerTransport();
  
  // Log transport events if debug is enabled
  if (debugStdio) {
    debugLog("TRANSPORT", "StdioServerTransport created");
    
    // Intercept stdio streams for debugging
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStdinOn = process.stdin.on.bind(process.stdin);
    
    // Log outgoing messages (stdout)
    process.stdout.write = function(chunk: string | Uint8Array, ...args: Array<unknown>): boolean {
      const chunkStr = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      debugLog("STDIO", "➡️ Writing to stdout", {
        preview: chunkStr.substring(0, 500),
        byteLength: chunk.length
      });
      
      // Try to parse as JSON-RPC
      try {
        const lines = chunkStr.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.includes('Content-Length:')) {
            debugLog("PROTOCOL", "Header detected", { header: line });
          } else if (line.startsWith('{')) {
            const jsonMsg = JSON.parse(line);
            debugLog("JSON-RPC", "Outgoing message", {
              method: jsonMsg.method,
              id: jsonMsg.id,
              hasParams: Boolean(jsonMsg.params),
              hasResult: Boolean(jsonMsg.result),
              hasError: Boolean(jsonMsg.error)
            });
          }
        }
      } catch {
        // Not JSON, ignore
      }
      
      return originalStdoutWrite.call(process.stdout, chunk);
    };
    
    // Log incoming messages (stdin)
    process.stdin.on = function(event: string, listener: (...args: Array<unknown>) => void): NodeJS.ReadStream {
      if (event === 'data') {
        const wrappedListener = (data: Buffer): void => {
          const dataStr = data.toString('utf8');
          debugLog("STDIO", "⬅️ Received on stdin", {
            preview: dataStr.substring(0, 500),
            byteLength: data.length
          });
          
          // Try to parse as JSON-RPC
          try {
            const lines = dataStr.split('\n').filter(line => line.trim());
            for (const line of lines) {
              if (line.includes('Content-Length:')) {
                debugLog("PROTOCOL", "Header detected", { header: line });
              } else if (line.startsWith('{')) {
                const jsonMsg = JSON.parse(line);
                debugLog("JSON-RPC", "Incoming message", {
                  method: jsonMsg.method,
                  id: jsonMsg.id,
                  hasParams: Boolean(jsonMsg.params)
                });
              }
            }
          } catch {
            // Not JSON, ignore
          }
          
          listener(data);
        };
        return originalStdinOn(event, wrappedListener as (...args: Array<unknown>) => void);
      }
      return originalStdinOn(event, listener);
    } as typeof process.stdin.on;
    
    debugLog("TRANSPORT", "Stdio interceptors installed");
  }
  
  await server.connect(transport);
  debugLog("LIFECYCLE", "Server connected to transport");
  console.error("Plausible MCP Server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});