import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCopilotToken,
  clearTokenCache,
  isTokenValid,
  type GetCopilotTokenResponse,
} from "../src/services/github/get-copilot-token";
import { createChatCompletions } from "../src/services/copilot/create-chat-completions";
import {
  buildCopilotHeaders,
  buildGitHubHeaders,
  resetVSCodeVersionCache,
} from "../src/lib/api-config";
import { TokenExchangeError, HttpError } from "../src/lib/error";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("buildGitHubHeaders", () => {
  it("returns required headers with token", () => {
    const headers = buildGitHubHeaders("test-token");
    expect(headers.Authorization).toBe("token test-token");
    expect(headers.Accept).toBe("application/json");
    expect(headers["User-Agent"]).toContain("GitHubCopilotChat");
  });
});

describe("buildCopilotHeaders", () => {
  beforeEach(() => {
    resetVSCodeVersionCache();
    mockFetch.mockReset();
  });

  it("returns required headers with bearer token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ["1.100.0"],
    });

    const headers = await buildCopilotHeaders("copilot-jwt");
    expect(headers.Authorization).toBe("Bearer copilot-jwt");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Editor-Version"]).toBe("vscode/1.100.0");
  });

  it("uses fallback version on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const headers = await buildCopilotHeaders("test");
    expect(headers["Editor-Version"]).toMatch(/^vscode\/\d+\.\d+\.\d+$/);
  });
});

describe("isTokenValid", () => {
  it("returns false for undefined", () => {
    expect(isTokenValid(undefined, Date.now())).toBe(false);
  });

  it("returns true for valid token", () => {
    const cached = { token: "test", expiresAt: Date.now() + 60000 };
    expect(isTokenValid(cached, Date.now())).toBe(true);
  });

  it("returns false for expired token", () => {
    const cached = { token: "test", expiresAt: Date.now() - 1000 };
    expect(isTokenValid(cached, Date.now())).toBe(false);
  });
});

describe("getCopilotToken", () => {
  beforeEach(() => {
    clearTokenCache();
    mockFetch.mockReset();
  });

  it("exchanges GitHub token for Copilot token", async () => {
    const mockResponse: GetCopilotTokenResponse = {
      token: "copilot-jwt-token",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
      refresh_in: 1500,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const token = await getCopilotToken("github-token");
    expect(token).toBe("copilot-jwt-token");
  });

  it("throws TokenExchangeError on 401", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(getCopilotToken("bad-token")).rejects.toThrow(
      TokenExchangeError
    );
  });

  it("caches token for subsequent calls", async () => {
    const mockResponse: GetCopilotTokenResponse = {
      token: "cached-token",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
      refresh_in: 1500,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const token1 = await getCopilotToken("github-token");
    const token2 = await getCopilotToken("github-token");

    expect(token1).toBe(token2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("createChatCompletions", () => {
  beforeEach(() => {
    resetVSCodeVersionCache();
    mockFetch.mockReset();
  });

  it("forwards request to Copilot API", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ["1.100.0"],
      })
      .mockResolvedValueOnce({
        ok: true,
        body: "stream",
        headers: new Headers({ "Content-Type": "text/event-stream" }),
      });

    const response = await createChatCompletions(
      "copilot-token",
      JSON.stringify({ model: "gpt-4", messages: [] })
    );

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe(
      "https://api.githubcopilot.com/chat/completions"
    );
  });
});

describe("Error classes", () => {
  it("HttpError has statusCode", () => {
    const error = new HttpError("Server error", 500);
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("HttpError");
  });

  it("TokenExchangeError extends HttpError", () => {
    const error = new TokenExchangeError("Token exchange failed", 401);
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe("TokenExchangeError");
    expect(error).toBeInstanceOf(HttpError);
  });
});
