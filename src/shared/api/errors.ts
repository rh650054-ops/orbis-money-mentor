import type { PostgrestError } from "@supabase/supabase-js";

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
}

const RETRYABLE_CODES = new Set([
  "PGRST301",
  "PGRST002",
  "ECONNRESET",
  "ETIMEDOUT",
  "FETCH_ERROR",
]);

function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as PostgrestError).message === "string"
  );
}

export function mapSupabaseError(err: unknown): AppError {
  if (isPostgrestError(err)) {
    return {
      code: err.code ?? "UNKNOWN",
      message: err.message || "Erro ao falar com o servidor.",
      retryable: RETRYABLE_CODES.has(err.code ?? ""),
    };
  }
  if (err instanceof Error) {
    return {
      code: err.name || "ERROR",
      message: err.message,
      retryable: false,
    };
  }
  return {
    code: "UNKNOWN",
    message: "Erro desconhecido.",
    retryable: false,
  };
}
