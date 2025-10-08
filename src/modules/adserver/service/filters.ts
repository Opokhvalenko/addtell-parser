export interface BidContext {
  size: string;
  type: string;
  geo: string;
  uid: string;
  floor: number;
  candidates: Array<{
    id: string;
    sizes: string[];
    adType: string;
    minCpm: number;
    maxCpm: number;
    geo: string[];
    frequencyPerDay: number;
  }>;
}

export function bySize(context: BidContext): BidContext | null {
  const filteredCandidates = context.candidates.filter((candidate) =>
    candidate.sizes.includes(context.size),
  );

  if (filteredCandidates.length === 0) {
    return null;
  }

  return {
    ...context,
    candidates: filteredCandidates,
  };
}

export function byCpm(context: BidContext): BidContext | null {
  const filteredCandidates = context.candidates.filter(
    (candidate) => context.floor >= candidate.minCpm && context.floor <= candidate.maxCpm,
  );

  if (filteredCandidates.length === 0) {
    return null;
  }

  return {
    ...context,
    candidates: filteredCandidates,
  };
}

export function byGeo(context: BidContext): BidContext | null {
  const filteredCandidates = context.candidates.filter((candidate) =>
    candidate.geo.includes(context.geo),
  );

  if (filteredCandidates.length === 0) {
    return null;
  }

  return {
    ...context,
    candidates: filteredCandidates,
  };
}
