import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";

// Mock services
vi.mock("../src/services/github/get-copilot-token", () => ({
  getCopilotToken: vi.fn(),
  clearTokenCache: vi.fn(),
  isTokenValid: vi.fn(),
}));

vi.mock("../src/services/copilot/create-chat-completions", () => ({
  createChatCompletions: vi.fn(),
}));

import { getCopilotToken } from "../src/services/github/get-copilot-token";
import { createChatCompletions } from "../src/services/copilot/create-chat-completions";
import { TokenExchangeError } from "../src/lib/error";

const mockGetCopilotToken = getCopilotToken as ReturnType<typeof vi.fn>;
const mockCreateChatCompletions = createChatCompletions as ReturnType<
  typeof vi.fn
>;

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /v1/models", () => {
  it("returns list of models", async () => {
    const res = await app.request("/v1/models");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe("list");
    expect(data.data).toContainEqual({
      id: "claude-opus-4",
      object: "model",
      owned_by: "anthropic",
    });
  });
});

describe("POST /v1/chat/completions", () => {
  beforeEach(() => {
    mockGetCopilotToken.mockReset();
    mockCreateChatCompletions.mockReset();
  });

  it("returns 401 without auth header", async () => {
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  it("forwards request on valid auth", async () => {
    mockGetCopilotToken.mockResolvedValue("copilot-token");
    mockCreateChatCompletions.mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer github-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4", messages: [] }),
    });

    expect(res.status).toBe(200);
    expect(mockGetCopilotToken).toHaveBeenCalledWith("github-token");
  });

  it("returns error on token exchange failure", async () => {
    mockGetCopilotToken.mockRejectedValue(
      new TokenExchangeError("Invalid token", 401)
    );

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer bad-token" },
      body: "{}",
    });

    expect(res.status).toBe(401);
  });
});

describe("404 fallback", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await app.request("/unknown");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
