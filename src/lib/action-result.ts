export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[] | undefined> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail<T = never>(
  error: string,
  extra?: { code?: string; fieldErrors?: Record<string, string[] | undefined> },
): ActionResult<T> {
  return { ok: false, error, ...extra };
}

type PostgrestLikeError = { message: string; code?: string };

const CODED_MESSAGE = /^([A-Z][A-Z0-9_]+):\s*([\s\S]+)$/;

/**
 * Database functions raise `CODE: human readable message`. Known codes are
 * surfaced to the user verbatim; anything else is logged and replaced with a
 * generic message so internals never leak to the client.
 */
export function parseDbError(error: PostgrestLikeError, context: string): { code: string; message: string } {
  const match = CODED_MESSAGE.exec(error.message);
  if (match) return { code: match[1], message: match[2] };

  console.error(`[db] ${context}:`, error);

  if (error.code === "42501") {
    return { code: "FORBIDDEN", message: "You are not allowed to perform this action." };
  }
  if (error.code === "23505") {
    return { code: "CONFLICT", message: "A record with these details already exists." };
  }
  return { code: "UNKNOWN", message: "Something went wrong. Please try again." };
}
