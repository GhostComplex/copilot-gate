/**
 * Tests for SSE utilities.
 */

import { describe, it, expect } from "vitest";
import { parseSSEStream } from "../src/sse";

function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("parseSSEStream", () => {
  it("parses simple data events", async () => {
    const stream = createReadableStream(["data: hello\n", "data: world\n"]);

    const events: { event?: string; data: string }[] = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([
      { event: undefined, data: "hello" },
      { event: undefined, data: "world" },
    ]);
  });

  it("parses events with event field", async () => {
    const stream = createReadableStream([
      "event: message_start\n",
      'data: {"type":"start"}\n',
      "event: content\n",
      'data: {"type":"delta"}\n',
    ]);

    const events: { event?: string; data: string }[] = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([
      { event: "message_start", data: '{"type":"start"}' },
      { event: "content", data: '{"type":"delta"}' },
    ]);
  });

  it("handles chunked data across boundaries", async () => {
    // Simulate data split across chunks
    const stream = createReadableStream(["data: hel", "lo\ndata: wo", "rld\n"]);

    const events: { event?: string; data: string }[] = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([
      { event: undefined, data: "hello" },
      { event: undefined, data: "world" },
    ]);
  });

  it("resets event after yielding", async () => {
    const stream = createReadableStream([
      "event: first\n",
      "data: one\n",
      "data: two\n", // No event field, should be undefined
    ]);

    const events: { event?: string; data: string }[] = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([
      { event: "first", data: "one" },
      { event: undefined, data: "two" },
    ]);
  });

  it("ignores empty lines and comments", async () => {
    const stream = createReadableStream([
      ": comment\n",
      "\n",
      "data: actual\n",
    ]);

    const events: { event?: string; data: string }[] = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ event: undefined, data: "actual" }]);
  });
});
