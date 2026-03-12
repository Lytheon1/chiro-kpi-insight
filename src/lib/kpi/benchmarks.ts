/**
 * Chiropractic operational benchmarks for KPI normalization.
 * These ranges prevent raw 0-100% mapping from producing misleading scores.
 *
 * Each benchmark defines poor/excellent thresholds. Values below poor = 0 pts,
 * above excellent = 100 pts. Intermediate values are linearly interpolated.
 */

export interface BenchmarkRange {
  poor: number;
  watch: number;
  healthy: number;
  excellent: number;
}

export const BENCHMARKS = {
  scheduleReliability: { poor: 0.60, watch: 0.75, healthy: 0.82, excellent: 0.90 },
  treatmentFollowThrough: { poor: 0.50, watch: 0.70, healthy: 0.82, excellent: 0.90 },
  npToRofConversion: { poor: 0.40, watch: 0.50, healthy: 0.65, excellent: 0.80 },
  careContinuation: { poor: 0.40, watch: 0.55, healthy: 0.70, excellent: 0.85 },
  disruptionResistance: { poor: 0.50, watch: 0.65, healthy: 0.78, excellent: 0.90 },
  cancellationRate: { poor: 0.20, watch: 0.14, healthy: 0.08, excellent: 0.08 },
} as const;

/**
 * Normalize a raw metric value against a benchmark range.
 * Maps the value into 0-100 based on poor→excellent range.
 */
export function normToBenchmark(value: number, poor: number, excellent: number): number {
  return Math.max(0, Math.min(100, ((value - poor) / (excellent - poor)) * 100));
}

/**
 * Get a status label from a benchmark range.
 */
export function getBenchmarkStatus(
  value: number,
  benchmark: BenchmarkRange,
  invertedScale = false
): 'excellent' | 'healthy' | 'watch' | 'risk' {
  if (invertedScale) {
    // For metrics where lower is better (e.g., cancellation rate)
    if (value <= benchmark.excellent) return 'excellent';
    if (value <= benchmark.healthy) return 'healthy';
    if (value <= benchmark.watch) return 'watch';
    return 'risk';
  }
  if (value >= benchmark.excellent) return 'excellent';
  if (value >= benchmark.healthy) return 'healthy';
  if (value >= benchmark.watch) return 'watch';
  return 'risk';
}

export const STATUS_COLORS = {
  excellent: 'text-success',
  healthy: 'text-success/80',
  watch: 'text-warning',
  risk: 'text-destructive',
} as const;

export const STATUS_BG = {
  excellent: 'bg-success/10 border-success/30',
  healthy: 'bg-success/10 border-success/20',
  watch: 'bg-warning/10 border-warning/30',
  risk: 'bg-destructive/10 border-destructive/30',
} as const;

export const STATUS_LABELS = {
  excellent: 'Excellent',
  healthy: 'Healthy',
  watch: 'Watch',
  risk: 'At Risk',
} as const;
