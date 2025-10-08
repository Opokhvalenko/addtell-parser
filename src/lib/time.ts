export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

export function timeDiff(start: Date, end: Date): number {
  return end.getTime() - start.getTime();
}
