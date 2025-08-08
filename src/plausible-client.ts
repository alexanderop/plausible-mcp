import { z } from "zod";

import { executeQuery } from "./api.js";
import {
  predefinedDateRanges,
  validMetrics,
  eventDimensions,
  visitDimensions,
  timeDimensions,
  filterOperators,
  logicalOperators,
  behavioralOperators,
} from "./constants.js";
import { validateAllParameters } from "./validation.js";

import type { PlausibleQuery, PlausibleApiResponse } from "./types.js";

// Zod schemas for validation
const dimensionSchema = z.union([
  z.enum(eventDimensions),
  z.enum(visitDimensions),
  z.enum(timeDimensions),
  z.string(),
]);

const simpleFilterSchema = z.tuple([
  z.string(),
  z.enum(filterOperators),
  z.union([z.string(), z.array(z.string())]),
]);

const logicalFilterSchema: z.ZodType = z.lazy(() =>
  z.tuple([
    z.enum(logicalOperators),
    z.array(z.union([simpleFilterSchema, logicalFilterSchema, behavioralFilterSchema])),
  ])
);

const behavioralFilterSchema = z.tuple([
  z.enum(behavioralOperators),
  z.union([z.literal("goal"), z.literal("page")]),
  z.string(),
]);

const filterSchema = z.union([
  simpleFilterSchema,
  logicalFilterSchema,
  behavioralFilterSchema,
]);

const queryParamsSchema = z.object({
  site_id: z.string().describe("Domain of the site in Plausible"),
  metrics: z
    .array(z.enum(validMetrics))
    .min(1)
    .describe("List of metrics to query"),
  date_range: z
    .union([
      z.enum(predefinedDateRanges).describe("Predefined date range"),
      z.tuple([z.string(), z.string()]).describe("Custom date range [start_date, end_date] in ISO8601"),
    ])
    .describe(`Date range to query. Either a predefined range (${predefinedDateRanges.join(", ")}) or custom date range as [start_date, end_date] in ISO8601 format`),
  dimensions: z
    .array(dimensionSchema)
    .optional()
    .describe("Dimensions to group by"),
  filters: z
    .array(filterSchema)
    .optional()
    .describe("Filters to apply"),
  order_by: z
    .array(z.tuple([z.string(), z.enum(["asc", "desc"])]))
    .optional()
    .describe("Sort order for results"),
  include: z
    .object({
      imports: z.boolean().optional().describe("Include imported data"),
      time_labels: z.boolean().optional().describe("Include time labels for time dimensions"),
      total_rows: z.boolean().optional().describe("Include total row count"),
    })
    .optional()
    .describe("Additional data to include"),
  pagination: z
    .object({
      limit: z.number().min(1).max(10000).optional().describe("Number of results (max 10000)"),
      offset: z.number().min(0).optional().describe("Number of results to skip"),
    })
    .optional()
    .describe("Pagination options"),
});

export class PlausibleClient {
  async query(params: PlausibleQuery): Promise<PlausibleApiResponse> {
    // Validate parameters
    validateAllParameters(params);
    
    // Execute the query
    return executeQuery(params);
  }
  
  getSchema(): z.ZodRawShape {
    return queryParamsSchema.shape;
  }
}