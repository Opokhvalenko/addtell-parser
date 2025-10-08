export function createHttpError(statusCode: number, message: string): Error {
  const error = new Error(message);
  (error as Error & { statusCode: number }).statusCode = statusCode;
  return error;
}

export function isHttpError(error: unknown): error is Error & { statusCode: number } {
  return error instanceof Error && "statusCode" in error;
}
