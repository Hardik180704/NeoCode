import { describe, expect, test } from "bun:test";
import {
  hasPendingToolCalls,
  submitSchema,
  type NeocodeUIMessage,
} from "./chat-validation";

const textMessage = {
  id: "message-1",
  role: "user",
  parts: [{ type: "text", text: "Inspect the repository" }],
} as NeocodeUIMessage;

describe("chat request validation", () => {
  test("accepts a supported model and mode", () => {
    const result = submitSchema.safeParse({
      id: "session-1",
      messages: [textMessage],
      mode: "PLAN",
      model: "claude-opus-4-6",
    });

    expect(result.success).toBe(true);
  });

  test("rejects empty messages and unsupported models", () => {
    expect(
      submitSchema.safeParse({
        id: "session-1",
        messages: [],
        mode: "PLAN",
        model: "claude-opus-4-6",
      }).success,
    ).toBe(false);

    expect(
      submitSchema.safeParse({
        id: "session-1",
        messages: [textMessage],
        mode: "PLAN",
        model: "unsupported-model",
      }).success,
    ).toBe(false);
  });

  test("detects pending tool calls while allowing completed calls", () => {
    const pending = {
      ...textMessage,
      parts: [{ type: "tool-readFile", state: "input-available" }],
    } as NeocodeUIMessage;
    const completed = {
      ...textMessage,
      parts: [{ type: "tool-readFile", state: "output-available" }],
    } as NeocodeUIMessage;

    expect(hasPendingToolCalls(pending)).toBe(true);
    expect(hasPendingToolCalls(completed)).toBe(false);
    expect(hasPendingToolCalls(textMessage)).toBe(false);
  });
});
