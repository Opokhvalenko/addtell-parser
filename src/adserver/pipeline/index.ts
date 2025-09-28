export type Filter<T> = { name: string; run: (items: T[]) => T[] };
export type Verdict<T> = { winner?: T | undefined; trace: { name: string; left: number }[] };

export async function runPipeline<T>(items: T[], filters: Filter<T>[]): Promise<Verdict<T>> {
  const trace: Verdict<T>["trace"] = [];
  let current = items.slice();
  for (const f of filters) {
    current = f.run(current);
    trace.push({ name: f.name, left: current.length });
    if (current.length === 0) return { trace };
  }
  return { winner: current[0], trace };
}
