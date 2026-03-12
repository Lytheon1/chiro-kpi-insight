/**
 * Clinic Health Score — weighted composite of 5 operational metrics.
 * Uses benchmark-anchored normalization (not raw 0-100%) to produce
 * contextually accurate scores for chiropractic practices.
 */
import { normToBenchmark } from './benchmarks';

export interface HealthScoreComponent {
  label: string;
  weight: number;
  rawValue: number;
  normalizedScore: number; // 0-100
  weightedContribution: number;
  poor: number;
  excellent: number;
}

export interface ClinicHealthScore {
  score: number; // 0-100
  status: 'excellent' | 'healthy' | 'watch' | 'risk';
  statusLabel: string;
  components: HealthScoreComponent[];
}

interface HealthScoreInputs {
  treatmentFollowThrough: number; // ROF → treatment start rate
  scheduleReliability: number;     // completed / scheduled
  disruptionResistance: number;    // 1 - disruption_rate
  npToRofConversion: number;       // NP → ROF rate
  careContinuation: number;        // 3+ tx visits / starters
}

const WEIGHTS = {
  treatmentFollowThrough: 0.30,
  scheduleReliability: 0.25,
  disruptionResistance: 0.20,
  npToRofConversion: 0.15,
  careContinuation: 0.10,
};

const RANGES: Record<string, { poor: number; excellent: number; label: string }> = {
  treatmentFollowThrough: { poor: 0.50, excellent: 0.95, label: 'Treatment Follow-Through' },
  scheduleReliability: { poor: 0.60, excellent: 0.97, label: 'Schedule Reliability' },
  disruptionResistance: { poor: 0.50, excellent: 0.90, label: 'Disruption Resistance' },
  npToRofConversion: { poor: 0.40, excellent: 0.85, label: 'NP → ROF Conversion' },
  careContinuation: { poor: 0.40, excellent: 0.90, label: 'Care Continuation' },
};

export function calculateClinicHealthScore(inputs: HealthScoreInputs): ClinicHealthScore {
  const components: HealthScoreComponent[] = [];

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const range = RANGES[key];
    const rawValue = inputs[key as keyof HealthScoreInputs];
    const normalizedScore = normToBenchmark(rawValue, range.poor, range.excellent);
    const weightedContribution = normalizedScore * weight;

    components.push({
      label: range.label,
      weight,
      rawValue,
      normalizedScore,
      weightedContribution,
      poor: range.poor,
      excellent: range.excellent,
    });
  }

  const score = Math.round(components.reduce((sum, c) => sum + c.weightedContribution, 0));

  let status: ClinicHealthScore['status'];
  let statusLabel: string;
  if (score >= 90) { status = 'excellent'; statusLabel = 'Excellent'; }
  else if (score >= 80) { status = 'healthy'; statusLabel = 'Healthy'; }
  else if (score >= 70) { status = 'watch'; statusLabel = 'Watch'; }
  else { status = 'risk'; statusLabel = 'At Risk'; }

  return { score, status, statusLabel, components };
}
