import { findSupportedChatModel } from "@neocode/shared";

export type NeoLensMetrics = ReturnType<typeof collectPersistedMetrics>;

export function collectPersistedMetrics(values: unknown[]) {
  let modelRuns = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let durationMs = 0;
  let estimatedCostUsd = 0;
  const models = new Set<string>();

  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const metadata = (value as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") continue;
    const record = metadata as Record<string, unknown>;
    const model = typeof record.model === "string" ? record.model : null;
    const usage = record.usage && typeof record.usage === "object"
      ? record.usage as Record<string, unknown>
      : null;
    const runDuration = finiteNonNegative(record.durationMs);
    if (runDuration !== null) durationMs += runDuration;
    if (!usage) continue;

    const runInput = finiteNonNegative(usage.inputTokens) ?? 0;
    const runOutput = finiteNonNegative(usage.outputTokens) ?? 0;
    const runTotal = finiteNonNegative(usage.totalTokens) ?? runInput + runOutput;
    inputTokens += runInput;
    outputTokens += runOutput;
    totalTokens += runTotal;
    modelRuns += 1;
    if (model) {
      models.add(model);
      const definition = findSupportedChatModel(model);
      if (definition) {
        estimatedCostUsd += (
          runInput * definition.pricing.inputUsdPerMillionTokens +
          runOutput * definition.pricing.outputUsdPerMillionTokens
        ) / 1_000_000;
      }
    }
  }

  return {
    modelRuns,
    models: [...models].sort(),
    inputTokens,
    outputTokens,
    totalTokens,
    durationMs,
    estimatedCostUsd,
  };
}

function finiteNonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
