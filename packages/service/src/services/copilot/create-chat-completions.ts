/**
 * Copilot API: Create chat completions.
 *
 * Matches copilot-api's services/copilot/create-chat-completions.ts
 */

import { buildCopilotHeaders } from "../../lib/api-config";

const COPILOT_API_BASE_URL = "https://api.githubcopilot.com";

/**
 * Forward chat completions request to Copilot API.
 * Returns raw Response for streaming support.
 */
export async function createChatCompletions(
  copilotToken: string,
  body: string
): Promise<Response> {
  const headers = await buildCopilotHeaders(copilotToken);
  return fetch(`${COPILOT_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body,
  });
}
