import { useState, useRef, useCallback, useEffect } from "react";
import { EventSourceParserStream } from "eventsource-parser/stream";
import prettyMs from "pretty-ms";
import type { ClientResponse } from "hono/client";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import type { mode as Mode } from "@neocode/database/enums";
import {
    chatStreamEventSchema,
    type SupportedChatModelId,
} from "@neocode/shared";
import { handle } from "hono/cloudflare-pages";
import { useNeoLens } from "../providers/neolens";

export type ClientToolCallPart = {
    type: "tool-call";
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: string;
    status: "calling" | "done";
}

export type ClientMessagePart =
    | { type: "reasoning"; text: string }
    | ClientToolCallPart
    | { type: "text"; text: string }

export type Message =
    | {
        id: string;
        role: "user";
        content: string;
        mode: Mode;
        model: SupportedChatModelId;
    }
    | {
        id: string;
        role: "assistant";
        content: string;
        mode: Mode;
        model: SupportedChatModelId;
        parts: ClientMessagePart[];
        duration?: string;
        interrupted?: boolean;
    }
    | {
        id: string;
        role: "error";
        content: string;
    };

type StreamingState =
    | { status: "idle" }
    | { status: "streaming"; parts: ClientMessagePart[]; mode: Mode; model: SupportedChatModelId; };

type ActiveStream = {
    requestId: string;
    controller: AbortController;
    mode: Mode;
    model: SupportedChatModelId;
    parts: ClientMessagePart[];
    interruptedCaptured: boolean;
};

type SubmitParams = {
    userText: string;
    mode: Mode;
    model: SupportedChatModelId;
};

type RunStreamParams = {
    mode: Mode;
    model: SupportedChatModelId;
    request: (controller: AbortController) => Promise<ClientResponse<unknown>>;
};

export function useChat(
    sessionId: string,
    initialMessages: Message[],
) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [streaming, setStreaming] = useState<StreamingState>({
        status: "idle",
    });
    const { recordActivity } = useNeoLens();
    const activeStreamRef = useRef<ActiveStream | null>(null);

    const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
        setMessages((prev) => updater(prev));
    }, []);

    const isActiveRequest = useCallback((requestId: string) => {
        return activeStreamRef.current?.requestId === requestId;
    }, []);

    const emitParts = useCallback((
        requestId: string,
        parts: ClientMessagePart[],
    ) => {
        if (!isActiveRequest(requestId)) return;

        const snapshot = [...parts];
        const activeStream = activeStreamRef.current;
        if (!activeStream) return;

        activeStream.parts = snapshot;
        setStreaming({
            status: "streaming",
            parts: snapshot,
            mode: activeStream.mode,
            model: activeStream.model,
        });
    }, [isActiveRequest]);

    const captureInterruptedMessage = useCallback((
        activeStream: ActiveStream
    ) => {
        if (
            activeStream.interruptedCaptured ||
            activeStream.parts.length === 0
        ) {
            return;
        }

        activeStream.interruptedCaptured = true;
        const parts = [...activeStream.parts];
        const fullText = parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");

        updateMessages((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                role: "assistant",
                content: fullText,
                mode: activeStream.mode,
                model: activeStream.model,
                parts,
                interrupted: true,
            },
        ]);
    }, [updateMessages]);

    const clearStream = useCallback(
        (requestId: string) => {
            if (!isActiveRequest(requestId)) return;

            activeStreamRef.current = null;
            setStreaming({ status: "idle" });
        },
        [isActiveRequest],
    );

    const handleStream = useCallback(async (
        response: ClientResponse<unknown>,
        activeStream: ActiveStream,
    ) => {
        if (!isActiveRequest(activeStream.requestId)) return;

        if (!response.ok) {
            const message = await getErrorMessage(response);
            updateMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "error",
                    content: message,
                },
            ]);
            return;
        };

        const parts: ClientMessagePart[] = [];

        const stream = response
            .body!.pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream());

        for await (const { data } of stream) {
            if (!isActiveRequest(activeStream.requestId)) return;

            let event;

            try {
                event = chatStreamEventSchema.parse(JSON.parse(data));
            } catch (err) {
                const message = err instanceof Error ? err.message : "Invalid stream event";
                updateMessages((prev) => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        role: "error",
                        content: message,
                    },
                ]);
                break;
            }

            switch (event.type) {
                case "reasoning-delta": {
                    const last = parts[parts.length - 1];
                    if (last && last.type === "reasoning") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "reasoning", text: event.text });
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "tool-call": {
                    parts.push({
                        type: "tool-call",
                        id: event.toolCallId,
                        name: event.toolName,
                        args: event.args,
                        status: "calling"
                    });
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "tool-result": {
                    const tc = parts.find(
                        (p): p is ClientToolCallPart => p.type === "tool-call" && p.id === event.toolCallId,
                    );
                    if (tc) {
                        tc.result = event.result;
                        tc.status = "done";
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "neolens-activity": {
                    recordActivity(sessionId, event.event);
                    break;
                }
                case "text-delta": {
                    const last = parts[parts.length - 1];
                    if (last && last.type === "text") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "text", text: event.text });
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "done": {
                    if (!isActiveRequest(activeStream.requestId)) return;

                    const fullText = parts
                        .filter((p) => p.type === "text")
                        .map((p) => p.text)
                        .join("");

                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: event.messageId,
                            role: "assistant",
                            content: fullText,
                            mode: activeStream.mode,
                            model: activeStream.model,
                            duration: prettyMs(event.durationMs),
                            parts: [...parts],
                        },
                    ]);
                    break;
                }
                case "error": {
                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role: "error",
                            content: event.message,
                        },
                    ]);
                    break;
                }
            }
        }
    }, [isActiveRequest, updateMessages, emitParts, recordActivity, sessionId]);

    const runStream = useCallback(async (
        { mode, model, request }: RunStreamParams
    ) => {
        const controller = new AbortController();
        const activeStream: ActiveStream = {
            requestId: crypto.randomUUID(),
            controller,
            mode,
            model,
            parts: [],
            interruptedCaptured: false,
        };

        activeStreamRef.current = activeStream;
        setStreaming({ status: "streaming", parts: [], mode, model });

        try {
            const response = await request(controller);
            await handleStream(response, activeStream);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }

            if (!isActiveRequest(activeStream.requestId)) return;

            const msg = err instanceof Error ? err.message : String(err);
            updateMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "error",
                    content: msg,
                },
            ]);
        } finally {
            clearStream(activeStream.requestId);
        }
    }, [clearStream, handleStream, isActiveRequest, updateMessages]);

    const stopActiveStream = useCallback((
        capturePartial: boolean
    ) => {
        const activeStream = activeStreamRef.current;
        if (!activeStream) return;

        if (capturePartial) {
            captureInterruptedMessage(activeStream);
        }

        activeStreamRef.current = null;
        setStreaming({ status: "idle" });
        activeStream.controller.abort();
    }, [captureInterruptedMessage]);

    const resume = useCallback(async (
        { mode, model }: Omit<SubmitParams, "userText">
    ) => {
        await runStream({
            mode,
            model,
            request: async (controller) => {
                return apiClient.chat[":sessionId"].resume.$post(
                    { param: { sessionId } },
                    { init: { signal: controller.signal } },
                );
            },
        });
    }, [runStream, sessionId]);

    // Auto-resume when the conversation ends with a user message that has no reply
    const hasAutoResumedRef = useRef(false);
    useEffect(() => {
        if (hasAutoResumedRef.current) return;
        const last = initialMessages[initialMessages.length - 1];
        if (!last || last.role !== "user") return;

        hasAutoResumedRef.current = true;
        void resume({ mode: last.mode, model: last.model });
    }, [initialMessages, resume]);

    const submit = useCallback(async (
        { userText, mode, model }: SubmitParams
    ) => {
        // Show the partial answer before sending the next message
        stopActiveStream(true);

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: userText,
            mode,
            model,
        };
        updateMessages((prev) => [...prev, userMessage]);

        await runStream({
            mode,
            model,
            request: async (controller) => {
                return apiClient.chat[":sessionId"].$post(
                    {
                        param: { sessionId },
                        json: {
                            content: userText,
                            mode,
                            model
                        }
                    },
                    { init: { signal: controller.signal } },
                );
            },
        });
    }, [runStream, sessionId, updateMessages, stopActiveStream]);

    const abort = useCallback(() => {
        stopActiveStream(false);
    }, [stopActiveStream]);

    const interrupt = useCallback(() => {
        stopActiveStream(true);
    }, [stopActiveStream]);

    return { messages, streaming, submit, abort, interrupt };
}

