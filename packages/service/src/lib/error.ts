/**
 * Error types.
 *
 * Matches copilot-api's lib/error.ts
 */

export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class TokenExchangeError extends HttpError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode);
    this.name = "TokenExchangeError";
  }
}
