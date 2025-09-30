/** Парсер списку джерел: JSON-масив, CSV або рядки з перенесеннями */
export function parseList(input?: string): string[] {
  if (!input) return [];
  try {
    const maybe = JSON.parse(input);
    if (Array.isArray(maybe)) return maybe.map(String).filter(Boolean);
  } catch {
    /* not json */
  }
  return input
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}
