/**
 * SSE (Server-Sent Events) utilities.
 */

import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

export interface SSEEvent {
  event?: string;
  data: string;
}

/**
 * Parse SSE stream from a ReadableStream.
 * Handles both `event:` and `data:` fields.
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          yield { event: currentEvent || undefined, data: line.slice(6) };
          currentEvent = "";
        }
      }
    }
  } finally {
    await reader.cancel();
  }
}

/**
 * Proxy SSE events from an upstream response, optionally transforming them.
 *
 * @param c - Hono context
 * @param body - Upstream response body (ReadableStream)
 * @param transform - Optional function to transform events. Return null to skip.
 */
export function proxySSE(
  c: Context,
  body: ReadableStream<Uint8Array>,
  transform?: (event: string | undefined, data: string) => SSEEvent[] | null
): Response {
  return streamSSE(c, async (stream) => {
    try {
      for await (const { event, data } of parseSSEStream(body)) {
        if (transform) {
          const results = transform(event, data);
          if (results) {
            for (const e of results) {
              await stream.writeSSE({ event: e.event, data: e.data });
            }
          }
        } else {
          await stream.writeSSE({ event, data });
        }
      }
    } catch (err) {
      console.error("SSE proxy error:", err);
    }
  });
}
