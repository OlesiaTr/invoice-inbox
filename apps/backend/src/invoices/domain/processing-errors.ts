/** Will never succeed for this file (corrupt, unsupported, no text). Fail immediately. */
export class PermanentProcessingError extends Error {}

/** Might succeed next time (timeouts, model hiccups, invalid model output). Retry with backoff. */
export class TransientProcessingError extends Error {}

export const errorMessage = (err: unknown): string => {
  return err instanceof Error ? err.message : String(err);
};
