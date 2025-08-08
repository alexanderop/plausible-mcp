#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { plausibleApiKey, debugStdio } from "./constants.js";
import { PlausibleClient } from "./plausible-client.js";
import { ValidationError } from "./types.js";
import { debugLog } from "./utils.js";

import type { PlausibleQuery } from "./types.js";

// Check for required API key
if (plausibleApiKey === undefined || plausibleApiKey === "") {
  throw new Error("PLAUSIBLE_API_KEY environment variable is required");
}

async function main(): Promise<void> {
  debugLog("MCP", "Starting Plausible MCP Server", {
    pid: process.pid,
    nodeVersion: process.version,
    debugEnabled: debugStdio
  });

  const server = new McpServer({
    name: "plausible-analytics",
    version: "1.0.0",
    description: "Query analytics data from Plausible Analytics"
  });

  const client = new PlausibleClient();

  // Register the plausible_query tool
  server.tool("plausible_query", "Query analytics data from Plausible Analytics", client.getSchema(), async (args: unknown) => {
    debugLog("TOOL", "plausible_query called", args);
    
    try {
      const params = args as PlausibleQuery;
      const result = await client.query(params);
      
      debugLog("TOOL", "Query successful", {
        resultsCount: result.results.length,
        hasMetadata: Boolean(result.meta)
      });
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      debugLog("ERROR", "Query failed", error);
      
      if (error instanceof ValidationError) {
        const errorMessage = error.details !== undefined && error.details !== ''
          ? `${error.message}\n\nDetails: ${error.details}`
          : error.message;
          
        return {
          content: [
            {
              type: "text" as const,
              text: `Validation Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  if (debugStdio) {
    debugLog("LIFECYCLE", "Debug mode enabled");
  }

  // Start the server
  const transport = new StdioServerTransport();
  
  debugLog("TRANSPORT", "Starting stdio transport");
  await server.connect(transport);
  
  console.error("Plausible MCP Server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});