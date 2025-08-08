import { inspect } from "util";

import { debugStdio } from "./constants.js";

// Utility functions

export function debugLog(category: string, message: string, data?: unknown): void {
  if (!debugStdio) return;
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${category}] ${message}`;
  console.error(logMessage);
  if (data !== undefined) {
    console.error("  DATA:", inspect(data, { depth: 3, colors: true }));
  }
}