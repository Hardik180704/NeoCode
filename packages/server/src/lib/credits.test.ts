import { describe, expect, test } from "bun:test";
import type { LanguageModelUsage } from "ai";
import { calculateCreditsForUsage } from "./credits";

function usage(inputTokens?: number, outputTokens?: number) {
  return { inputTokens, outputTokens } as LanguageModelUsage;
}

describe("billing credit calculation", () => {
  test("does not charge for zero usage", () => {
    expect(
      calculateCreditsForUsage({
        provider: "openai",
        model: "gpt-5.4",
        usage: usage(0, 0),
      }),
    ).toEqual({ credits: 0 });
  });

  test("rounds a non-zero cost up to at least one credit", () => {
    expect(
      calculateCreditsForUsage({
        provider: "openai",
        model: "gpt-5.4-nano",
        usage: usage(1, 1),
      }),
    ).toEqual({ credits: 1 });
  });

  test("uses the configured model pricing", () => {
    expect(
      calculateCreditsForUsage({
        provider: "openai",
        model: "gpt-5.4",
        usage: usage(1_000_000, 1_000_000),
      }),
    ).toEqual({ credits: 1750 });
  });

  test("rejects incomplete usage and unsupported billing models", () => {
    expect(() =>
      calculateCreditsForUsage({
        provider: "openai",
        model: "gpt-5.4",
        usage: usage(undefined, 10),
      }),
    ).toThrow("Credit conversion requires input and output token counts");

    expect(() =>
      calculateCreditsForUsage({
        provider: "openai",
        model: "unknown-model",
        usage: usage(10, 10),
      }),
    ).toThrow("Unsupported billing model: unknown-model");
  });
});
