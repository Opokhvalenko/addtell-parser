//src/ulils/retry.ts
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, base = 500) {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, base * 2 ** i));
    }
  }
  throw last;
}
