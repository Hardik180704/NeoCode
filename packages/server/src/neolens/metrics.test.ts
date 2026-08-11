import { describe, expect, test } from "bun:test";
import { collectPersistedMetrics } from "./metrics";

describe("NeoLens generation metrics", () => {
  test("aggregates usage, duration, model names, and estimated cost", () => {
    expect(collectPersistedMetrics([
      {
        metadata: {
          model: "claude-sonnet-4-6",
          durationMs: 1_200,
          usage: { inputTokens: 1_000_000, outputTokens: 100_000, totalTokens: 1_100_000 },
        },
      },
      {
        metadata: {
          model: "gpt-5.4-mini",
          durationMs: 800,
          usage: { inputTokens: 20_000, outputTokens: 10_000, totalTokens: 30_000 },
        },
      },
    ])).toEqual({
      modelRuns: 2,
      models: ["claude-sonnet-4-6", "gpt-5.4-mini"],
      inputTokens: 1_020_000,
      outputTokens: 110_000,
      totalTokens: 1_130_000,
      durationMs: 2_000,
      estimatedCostUsd: 4.56,
    });
  });

  test("ignores malformed and negative values", () => {
    expect(collectPersistedMetrics([
      null,
      { metadata: { durationMs: -1, usage: { inputTokens: "100", outputTokens: Number.NaN } } },
    ])).toMatchObject({
      modelRuns: 1,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs: 0,
      estimatedCostUsd: 0,
    });
  });
});
