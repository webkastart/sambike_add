export function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function campaignPerformance(input: { spendCents: number | null; leads: number; completed: number; revenueCents: number }) {
  const spend = input.spendCents;
  return {
    cplCents: spend == null || input.leads === 0 ? null : Math.round(spend / input.leads),
    costPerCompletedCents: spend == null || input.completed === 0 ? null : Math.round(spend / input.completed),
    roas: spend == null || spend === 0 ? null : input.revenueCents / spend,
  };
}
