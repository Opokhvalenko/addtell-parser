export async function selectFirst<T>(
  items: T[],
  predicates: Array<(x: T) => boolean | Promise<boolean>>,
): Promise<T | null> {
  for (const it of items) {
    let ok = true;
    for (const p of predicates) {
      const pass = await p(it);
      if (!pass) {
        ok = false;
        break;
      }
    }
    if (ok) return it;
  }
  return null;
}
