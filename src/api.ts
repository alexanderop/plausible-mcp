import { plausibleApiUrl, plausibleApiKey } from "./constants.js";

import type { PlausibleQuery, PlausibleApiResponse } from "./types.js";

// API query execution

export async function executeQuery(query: PlausibleQuery & {
  debug?: boolean
}): Promise<PlausibleApiResponse> {
  const { debug: _debug, ...queryParams } = query;
  
  try {
    const response = await fetch(`${plausibleApiUrl}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${plausibleApiKey ?? ""}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed with status ${String(response.status)}`;
      
      try {
        const errorJson = JSON.parse(errorText) as { error?: string };
        if (errorJson.error !== undefined && errorJson.error !== '') {
          errorMessage = errorJson.error;
        }
      } catch {
        errorMessage = errorText !== '' ? errorText : errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json() as PlausibleApiResponse;
    
    // Include the original query in the response for reference
    return {
      ...data,
      query: queryParams,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}