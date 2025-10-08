import * as retry from "retry";
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  minTimeout: number = 200,
): Promise<T> {
  const operationWithRetry = retry.operation({
    retries: maxRetries,
    factor: 2,
    minTimeout,
    maxTimeout: 1500,
  });
  return new Promise((resolve, reject) => {
    operationWithRetry.attempt(async (_currentAttempt: number) => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in (error as Record<string, unknown>)
            ? (error as { statusCode?: unknown }).statusCode
            : undefined;
        if (typeof statusCode === "number" && statusCode < 500) {
          const nonRetryableError =
            error instanceof Error
              ? error
              : new Error(`Non-retryable error (statusCode ${statusCode})`);
          if (!(error instanceof Error)) {
            (nonRetryableError as Error & { cause?: unknown }).cause = error;
          }
          reject(nonRetryableError);
          return;
        }
        if (operationWithRetry.retry(error as Error)) {
          return;
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}
