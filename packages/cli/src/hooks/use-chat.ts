import { useMemo, useRef } from "react";
import { useChat as useAiChat } from "@ai-sdk/react";
import {
    DefaultChatTransport,
    type InferUITools,
    lastAssistantMessageIsCompleteWithToolCalls,
    type LanguageModelUsage,
    type UIMessage,
} from "ai";
import {
    type NeoLensActivityEvent,
    type NeoLensFileStatus,
    type ModeType,
    type SupportedChatModelId,
    type ToolContracts,
} from "@neocode/shared";
import { apiClient } from "../lib/api-client";
import { getAuth } from "../lib/auth";
import { executeLocalTool } from "../lib/local-tools";
import { useNeoLens } from "../providers/neolens";

function activityEvent(
    toolCallId: string,
    toolName: string,
    input: unknown,
    phase: "started" | "completed",
    failed = false,
    sessionStartedAt = Date.now(),
    toolStartedAt?: number,
): NeoLensActivityEvent {
    const timestampMs = Date.now();
    const args = input && typeof input === "object" ? input as Record<string, unknown> : {};
    const filePaths = Object.entries(args)
        .filter(([key, value]) => /^(?:path|file|filePath)$/i.test(key) && typeof value === "string")
        .map(([, value]) => value as string);
    const status: NeoLensFileStatus = failed
        ? "failed"
        : /(?:write|edit|create|delete|remove|update)/i.test(toolName)
          ? "modified"
          : "inspected";
    return {
        id: `${toolCallId}:${phase}`,
        toolCallId,
        toolName,
        phase,
        status,
        filePaths,
        timestampMs,
        offsetMs: Math.max(0, timestampMs - sessionStartedAt),
        ...(phase === "completed" && toolStartedAt
            ? { durationMs: Math.max(0, timestampMs - toolStartedAt) }
            : {}),
        summary: `${status[0]!.toUpperCase()}${status.slice(1)} ${filePaths[0] ?? toolName}`,
    };
}

export type ChatMessageMetadata = {
    mode?: ModeType;
    model?: SupportedChatModelId | string;
    durationMs?: number;
    usage?: LanguageModelUsage;
}

type ChatTools = {
    [Name in keyof InferUITools<ToolContracts>]: {
        input: InferUITools<ToolContracts>[Name]['input'],
        output: unknown;
    }
}

export type Message = UIMessage<ChatMessageMetadata, never, ChatTools>;

export function useChat(sessionId: string, initialMessages: Message[]) {
    const { recordActivity } = useNeoLens();
    const sessionStartedAt = useRef(Date.now());
    const toolStartedAt = useRef(new Map<string, number>());
    const transport = useMemo(() => {
        return new DefaultChatTransport<Message>({
            api: apiClient.chat.$url().toString(),
            headers() {
                const auth = getAuth();
                return auth ? { Authorization: `Bearer ${auth.token}` } : new Headers();
            },
            prepareSendMessagesRequest({ messages }) {
                const message = messages[messages.length - 1];
                if (!message) throw new Error("No messages to send");

                const metadata = messages.findLast(
                    (m) => m.metadata?.mode && m.metadata?.model
                )?.metadata;

                const previousMessage = messages[messages.length - 1];
                const requestMessages = message.role === "assistant" && previousMessage?.role === "user"
                    ? [previousMessage, message]
                    : [message];

                return {
                    body: {
                        id: sessionId,
                        messages: requestMessages,
                        mode: message.metadata?.mode || metadata?.mode,
                        model: message.metadata?.model || metadata?.model,
                    },
                }
            }
        })
    }, [sessionId]);

    const chat = useAiChat<Message>({
        id: sessionId,
        messages: initialMessages,
        transport,
        onToolCall({ toolCall }) {
            const mode = chat.messages.at(-1)?.metadata?.mode ?? "BUILD";
            const startedAt = Date.now();
            toolStartedAt.current.set(toolCall.toolCallId, startedAt);
            recordActivity(sessionId, activityEvent(
                toolCall.toolCallId,
                toolCall.toolName,
                toolCall.input,
                "started",
                false,
                sessionStartedAt.current,
            ));

            void executeLocalTool(toolCall.toolName, toolCall.input, mode)
                .then((output) => {
                    recordActivity(sessionId, activityEvent(
                        toolCall.toolCallId,
                        toolCall.toolName,
                        toolCall.input,
                        "completed",
                        false,
                        sessionStartedAt.current,
                        toolStartedAt.current.get(toolCall.toolCallId),
                    ));
                    toolStartedAt.current.delete(toolCall.toolCallId);
                    return chat.addToolOutput({
                        tool: toolCall.toolName as keyof ChatTools,
                        toolCallId: toolCall.toolCallId,
                        output,
                    });
                })
                .catch((error) => {
                recordActivity(sessionId, activityEvent(
                    toolCall.toolCallId,
                    toolCall.toolName,
                    toolCall.input,
                    "completed",
                    true,
                    sessionStartedAt.current,
                    toolStartedAt.current.get(toolCall.toolCallId),
                ));
                toolStartedAt.current.delete(toolCall.toolCallId);
                return chat.addToolOutput({
                    tool: toolCall.toolName as keyof ChatTools,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: error instanceof Error ? error.message : String(error),
                });
            });
        },
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls
    });
    return {
        messages: chat.messages,
        status: chat.status,
        error: chat.error,
        submit: (params: { userText: string; mode: ModeType; model: SupportedChatModelId}) => {
            return chat.sendMessage({
                text: params.userText,
                metadata: {
                    mode: params.mode,
                    model: params.model,
                },
            })
        },
        abort: chat.stop,
        interrupt: chat.stop,
    };
}
