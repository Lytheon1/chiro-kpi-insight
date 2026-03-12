/**
 * Stable provider color assignment.
 * Each provider gets a consistent color across all charts.
 */

const PROVIDER_PALETTE = [
  'hsl(220, 40%, 30%)',   // navy
  'hsl(200, 50%, 40%)',   // steel blue
  'hsl(160, 40%, 35%)',   // teal
  'hsl(30, 55%, 45%)',    // amber
  'hsl(340, 35%, 40%)',   // muted rose
  'hsl(270, 30%, 45%)',   // muted purple
  'hsl(140, 35%, 40%)',   // forest
  'hsl(15, 50%, 45%)',    // terracotta
];

const providerColorMap = new Map<string, string>();

export function getProviderColor(provider: string): string {
  const key = provider.toLowerCase().trim();
  if (providerColorMap.has(key)) return providerColorMap.get(key)!;
  const idx = providerColorMap.size % PROVIDER_PALETTE.length;
  providerColorMap.set(key, PROVIDER_PALETTE[idx]);
  return PROVIDER_PALETTE[idx];
}

export function resetProviderColors() {
  providerColorMap.clear();
}

export function isSingleProviderMode(providers: string[]): boolean {
  return providers.length <= 1;
}
