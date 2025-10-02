import retry from "async-retry";

export async function withRetry<T>(
  fn: () => Promise<T>,
  retriesOrNote?: number | string,
  minTimeout?: number,
): Promise<T> {
  const retries = typeof retriesOrNote === "number" ? retriesOrNote : 3;

  return retry(
    async (bail) => {
      try {
        return await fn();
      } catch (err) {
        const statusCode =
          typeof err === "object" &&
          err !== null &&
          "statusCode" in (err as Record<string, unknown>)
            ? (err as { statusCode?: unknown }).statusCode
            : undefined;

        if (typeof statusCode === "number" && statusCode < 500) {
          const nonRetryable =
            err instanceof Error
              ? err
              : new Error(`Non-retryable error (statusCode ${statusCode})`);
          if (!(err instanceof Error)) {
            (nonRetryable as Error & { cause?: unknown }).cause = err;
          }
          bail(nonRetryable);
          return undefined as never;
        }

        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    { retries, factor: 2, minTimeout: minTimeout ?? 200, maxTimeout: 1500 },
  );
}
