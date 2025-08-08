// src/client.ts
import { inspect } from "util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const DEBUG_STDIO = process.env.DEBUG_STDIO === "true";

// Debug logging helper
function debugLog(category: string, message: string, data?: unknown): void {
  if (!DEBUG_STDIO) return;
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [CLIENT] [${category}] ${message}`;
  console.error(logMessage);
  if (data !== undefined) {
    console.error("  DATA:", inspect(data, { depth: 3, colors: true }));
  }
}

async function main(): Promise<void> {
  console.log("Starting Model Context Protocol client...");
  
  debugLog("LIFECYCLE", "Starting MCP client", {
    pid: process.pid,
    nodeVersion: process.version,
    debugEnabled: DEBUG_STDIO
  });
  const serverScript = process.argv[2] ?? "build/index.js";
  const siteId = process.argv[3] ?? "alexop.dev";

  // Spawn your server via stdio
  const transport = new StdioClientTransport({
    command: process.execPath,          // node
    args: [serverScript],               // path to built server
    env: {
      ...process.env,
      // make sure the server can read the key
      PLAUSIBLE_API_KEY: process.env.PLAUSIBLE_API_KEY ?? "",
      DEBUG_STDIO: process.env.DEBUG_STDIO ?? "false"
    }
  });
  
  debugLog("TRANSPORT", "Created StdioClientTransport", {
    command: process.execPath,
    args: [serverScript],
    hasApiKey: Boolean(process.env.PLAUSIBLE_API_KEY)
  });

  const client = new Client({
    name: "plausible-mcp-test-client", 
    version: "0.1.0"
  }, {
    capabilities: {}
  });
  
  debugLog("CLIENT", "Created MCP client instance");
  
  debugLog("CONNECTION", "Connecting client to transport...");
  await client.connect(transport);
  debugLog("CONNECTION", "Client connected successfully");

  // See what tools the server exposes
  debugLog("TOOLS", "Listing available tools...");
  const { tools } = await client.listTools();
  console.log("Tools:", tools.map(t => t.name));
  debugLog("TOOLS", "Available tools", tools.map(t => ({ name: t.name, description: t.description?.substring(0, 100) })));

  // Call one tool (adjust to your tool names/args)
  try {
    const toolCall = {
      name: "plausible_query",
      arguments: {
        site_id: siteId,
        metrics: ["visitors", "pageviews"],
        date_range: "30d"
      }
    };
    
    debugLog("TOOL_CALL", "Calling tool", toolCall);
    const res = await client.callTool(toolCall);
    debugLog("TOOL_RESPONSE", "Tool call successful", { responseLength: JSON.stringify(res).length });
    console.log("Result:", JSON.stringify(res, null, 2));
  } catch (error) {
    debugLog("ERROR", "Tool call failed", error);
    console.error("Error calling tool:", error);
  }
  
  debugLog("LIFECYCLE", "Closing client connection...");
  await client.close();
  debugLog("LIFECYCLE", "Client closed successfully");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});