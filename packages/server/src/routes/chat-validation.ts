import {
  type InferUITools,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import {
  modeSchema,
  type ModeType,
  type ToolContracts,
} from "@neocode/shared";
import { z } from "zod";
import { isSupportedChatModel } from "../lib/models";

type ChatMessageMetadata = {
  mode?: ModeType;
  model?: string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

export type NeocodeUIMessage = UIMessage<
  ChatMessageMetadata,
  never,
  InferUITools<ToolContracts>
>;

export const submitSchema = z.object({
  id: z.string().min(1),
  messages: z
    .array(
      z.custom<NeocodeUIMessage>((value) => {
        return (
          value !== null &&
          typeof value === "object" &&
          "id" in value &&
          "parts" in value &&
          Array.isArray(value.parts)
        );
      }),
    )
    .min(1),
  mode: modeSchema,
  model: z.string().refine(isSupportedChatModel, "Unsupported model"),
});

export function hasPendingToolCalls(message: NeocodeUIMessage) {
  return message.parts.some((part) => {
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const state = (part as { state?: string }).state;
      return state !== "output-available" && state !== "output-error";
    }
    return false;
  });
}
