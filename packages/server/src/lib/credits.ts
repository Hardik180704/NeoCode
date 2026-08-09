import {
  SUPPORTED_CHAT_MODELS,
  findSupportedChatModel,
  type ModelPricing,
} from "@neocode/shared";
import type { LanguageModelUsage } from "ai";

type CalculateCreditsForUsageParams = {
  provider: string;
  model: string;
  usage: LanguageModelUsage;
};

type BillableUsage = {
  credits: number;
};

type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
};

const TOKENS_PER_MILLION = 1_000_000;
// Nightcode charges in internal credits instead of exposing provider pricing.
// We currently peg 1 credit to $0.01 so credits stay easy to reason about
// like cents, while still being granular enough for small AI usage. Change
// this constant if product wants a finer unit like 0.001 or a coarser one.
const USD_PER_CREDIT = 0.01;

function getTokenCounts(usage: LanguageModelUsage): TokenCounts {
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;

  if (inputTokens == null || outputTokens == null) {
    throw new Error("Credit conversion requires input and output token counts");
  }

  return {
    inputTokens,
    outputTokens,
  };
}

function getModelPricing(provider: string, model: string): ModelPricing {
  const supportedModel = findSupportedChatModel(model);

  if (!supportedModel || supportedModel.provider !== provider) {
    if (
      !SUPPORTED_CHAT_MODELS.some(
        (supportedModel) => supportedModel.provider === provider,
      )
    ) {
      throw new Error(`Unsupported billing provider: ${provider}`);
    }

    throw new Error(`Unsupported billing model: ${model}`);
  }

  return supportedModel.pricing;
}

function estimateCostUsd(
  { inputTokens, outputTokens }: TokenCounts,
  pricing: ModelPricing,
) {
  return (
    (inputTokens * pricing.inputUsdPerMillionTokens +
      outputTokens * pricing.outputUsdPerMillionTokens) /
    TOKENS_PER_MILLION
  );
}

function convertUsdToCredits(estimatedCostUsd: number) {
  if (estimatedCostUsd <= 0) {
    return 0;
  }

  // If a request costs any non-zero amount, charge at least 1 credit, then
  // round up so partial credits always become a whole credit.
  return Math.max(1, Math.ceil(estimatedCostUsd / USD_PER_CREDIT));
}

export function calculateCreditsForUsage({
  provider,
  model,
  usage,
}: CalculateCreditsForUsageParams): BillableUsage {
  const tokenCounts = getTokenCounts(usage);
  const pricing = getModelPricing(provider, model);
  const estimatedCostUsd = estimateCostUsd(tokenCounts, pricing);
  const credits = convertUsdToCredits(estimatedCostUsd);

  return {
    credits,
  };
}
