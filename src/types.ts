// Type definitions for Plausible Analytics MCP Server

// Filter types
export type SimpleFilter = [
  string, // dimension
  string, // operator
  string | Array<string> // value(s)
];

export type LogicalFilter = [
  string, // logical operator
  Array<SimpleFilter | LogicalFilter | BehavioralFilter> // nested filters
];

export type BehavioralFilter = [
  string, // behavioral operator
  "goal" | "page", // type
  string // value
];

export type SegmentFilter = ["is", "segment", Array<number>];

export type FilterType = SimpleFilter | LogicalFilter | BehavioralFilter | SegmentFilter;

// Main query type
export type PlausibleQuery = {
  site_id: string;
  metrics: Array<string>;
  date_range: string | [string, string];
  dimensions?: Array<string>;
  filters?: Array<FilterType>;
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
};

// API Response types
export type PlausibleApiResponse = {
  results: Array<{
    dimensions: Array<string>;
    metrics: Array<number>;
  }>;
  meta?: {
    time_labels?: Array<string>;
    total_rows?: number;
  };
  query: PlausibleQuery;
};

// Error class
export class ValidationError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}