export function parseList(input: string): string[] {
  if (!input || input.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Not JSON, continue with CSV parsing
  }

  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
