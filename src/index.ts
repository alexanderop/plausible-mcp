#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const PLAUSIBLE_API_URL =
  process.env.PLAUSIBLE_API_URL ?? "https://plausible.io/api/v2";
const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY;

if (PLAUSIBLE_API_KEY === undefined || PLAUSIBLE_API_KEY === "") {
  throw new Error("PLAUSIBLE_API_KEY environment variable is required");
}

const predefinedDateRanges = [
  "day", "7d", "28d", "30d", "91d", "month", "6mo", "12mo", "year", "all"
] as const;

const validMetrics = [
  "visitors", "visits", "pageviews", "views_per_visit", "bounce_rate",
  "visit_duration", "events", "scroll_depth", "percentage", 
  "conversion_rate", "group_conversion_rate", "average_revenue", "total_revenue",
  "time_on_page"
] as const;

// Plausible API client
class PlausibleClient {
  async query(siteId: string, metrics: Array<string>, dateRange: string | [string, string]): Promise<unknown> {
    const response = await fetch(`${PLAUSIBLE_API_URL}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PLAUSIBLE_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        site_id: siteId,
        metrics: metrics,
        date_range: dateRange,
      }),
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

// Register the plausible_query tool
server.tool(
  "plausible_query",
  `Query analytics data from Plausible

This tool allows you to fetch various metrics from Plausible Analytics for a given site and date range.

Metrics include:
• visitors - The number of unique visitors
• visits - The number of visits/sessions
• pageviews - The number of pageview events
• views_per_visit - The number of pageviews divided by the number of visits
• bounce_rate - Bounce rate percentage
• visit_duration - Visit duration in seconds
• events - The number of events (pageviews + custom events)
• scroll_depth - Page scroll depth averaged per session
• percentage - The percentage of visitors of total who fall into this category
• conversion_rate - The percentage of visitors who completed the goal
• group_conversion_rate - The percentage of visitors who completed the goal with the same dimension
• average_revenue - Average revenue per revenue goal conversion
• total_revenue - Total revenue from revenue goal conversions
• time_on_page - Average time in seconds spent on a page per visit`,
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
  },
  async ({ site_id, metrics, date_range }) => {
    try {
      const response = await plausibleClient.query(
        site_id as string,
        metrics as Array<string>,
        date_range as string | [string, string]
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error querying Plausible API: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);





// Main function to start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Plausible MCP Server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});