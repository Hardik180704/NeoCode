import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useParams } from "react-router";
import type { InferResponseType } from "hono/client";
import {
  buildTypeScriptDependencyGraph,
  type NeoLensActivityEvent,
  type NeoLensFileStatus,
} from "@neocode/shared";
import { apiClient } from "../../lib/api-client";
import { getErrorMessage } from "../../lib/http-errors";
import { useKeyboardLayer } from "../../providers/keyboard-layer";
import { useNeoLens } from "../../providers/neolens";
import { useTheme } from "../../providers/theme";
import { NeoLensWorkspacePanel } from "./neolens-workspace-panel";

type RemoteNeoLensSnapshot = InferResponseType<
  (typeof apiClient.neolens)[":sessionId"]["$get"],
  200
>;
type GraphNode = RemoteNeoLensSnapshot["graph"]["nodes"][number];
type GraphEdge = RemoteNeoLensSnapshot["graph"]["edges"][number];
type NeoLensSnapshot = Omit<RemoteNeoLensSnapshot, "graph"> & {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    truncated: boolean;
  };
};
type NeoLensView = "graph" | "workspace" | "timeline";

const STATUS_ICON: Record<NeoLensFileStatus, string> = {
  inspected: "◉",
  modified: "◆",
  failed: "×",
  verified: "✓",
};
const EMPTY_METRICS = {
  modelRuns: 0,
  models: [] as string[],
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  durationMs: 0,
  estimatedCostUsd: 0,
};

function mergeEvents(
  persisted: NeoLensActivityEvent[],
  live: NeoLensActivityEvent[],
) {
  const byId = new Map<string, NeoLensActivityEvent>();
  for (const event of persisted) byId.set(event.id, event);
  for (const event of live) byId.set(event.id, event);
  return [...byId.values()].toSorted(
    (left, right) => left.timestampMs - right.timestampMs,
  );
}

function fileNode(path: string): GraphNode {
  return {
    id: path,
    path,
    label: path.split("/").at(-1) ?? path,
    kind: "file",
  };
}

function dedupeById<T extends { id: string }>(values: T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

function dedupeEdges(values: GraphEdge[]): GraphEdge[] {
  const byKey = new Map<string, GraphEdge>();
  for (const edge of values) {
    byKey.set(`${edge.source}\0${edge.target}\0${edge.kind}`, edge);
  }
  return [...byKey.values()];
}

export function NeoLensDialogContent({ sessionId: explicitSessionId }: { sessionId?: string }) {
  const { id: routeSessionId } = useParams();
  const sessionId = explicitSessionId ?? routeSessionId;
  const [snapshot, setSnapshot] = useState<NeoLensSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [replayEnabled, setReplayEnabled] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [view, setView] = useState<NeoLensView>("graph");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const { getActivity } = useNeoLens();
  const { isTopLayer } = useKeyboardLayer();
  const { colors } = useTheme();
  const dimensions = useTerminalDimensions();
  const liveEvents = sessionId ? getActivity(sessionId) : [];

  const loadSnapshot = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      const cwd = process.cwd();
      const [response, localGraph] = await Promise.all([
        apiClient.neolens[":sessionId"].$get({ param: { sessionId } }),
        buildTypeScriptDependencyGraph(cwd),
      ]);
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const data = await response.json();
      const merged = {
        ...data,
        // Keep the CLI usable during a rolling deployment against an older API.
        traceSchemaVersion: data.traceSchemaVersion ?? 0,
        metrics: data.metrics ?? EMPTY_METRICS,
        cwd,
        graph: {
          nodes: dedupeById([...localGraph.nodes, ...data.graph.nodes]),
          edges: dedupeEdges([...localGraph.edges, ...data.graph.edges]),
          truncated: localGraph.truncated || data.graph.truncated,
        },
      } satisfies NeoLensSnapshot;
      setSnapshot(merged);
      setSelectedNodeId((current) => current ?? merged.graph.nodes[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load NeoLens");
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const timeline = useMemo(
    () => mergeEvents(snapshot?.timeline ?? [], liveEvents),
    [snapshot?.timeline, liveEvents],
  );
  const activityPaths = useMemo(
    () => new Set(timeline.flatMap((event) => event.filePaths)),
    [timeline],
  );
  const visibleEvents = replayEnabled
    ? timeline.slice(0, Math.min(replayIndex + 1, timeline.length))
    : timeline;

  const nodes = useMemo(() => {
    const byId = new Map<string, GraphNode>();
    for (const node of snapshot?.graph.nodes ?? []) byId.set(node.id, node);
    for (const event of timeline) {
      for (const path of event.filePaths) {
        if (!byId.has(path)) byId.set(path, fileNode(path));
      }
    }
    return [...byId.values()];
  }, [snapshot?.graph.nodes, timeline]);

  const statusByNode = useMemo(() => {
    const statuses = new Map<string, NeoLensFileStatus>();
    for (const event of visibleEvents) {
      for (const path of event.filePaths) statuses.set(path, event.status);
      if (event.mcpServer) statuses.set(`mcp:${event.mcpServer}`, event.status);
    }
    return statuses;
  }, [visibleEvents]);

  const sortedNodes = useMemo(
    () => nodes.toSorted((left, right) => {
      const leftActive = statusByNode.has(left.id) ? 0 : 1;
      const rightActive = statusByNode.has(right.id) ? 0 : 1;
      return leftActive - rightActive || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
    }),
    [nodes, statusByNode],
  );
  const selectedIndex = Math.max(0, sortedNodes.findIndex((node) => node.id === selectedNodeId));
  const selectedNode = sortedNodes[selectedIndex] ?? null;
  const edges: GraphEdge[] = snapshot?.graph.edges ?? [];
  const outgoing = selectedNode
    ? edges.filter((edge) => edge.source === selectedNode.id)
    : [];
  const incoming = selectedNode
    ? edges.filter((edge) => edge.target === selectedNode.id)
    : [];
  const selectedActivity = selectedNode
    ? visibleEvents.filter((event) =>
        event.filePaths.includes(selectedNode.id) ||
        (selectedNode.kind === "mcp" && `mcp:${event.mcpServer}` === selectedNode.id),
      ).at(-1)
    : undefined;

  useEffect(() => {
    if (timeline.length === 0) {
      setReplayIndex(0);
      return;
    }
    if (!replayEnabled) setReplayIndex(timeline.length - 1);
  }, [timeline.length, replayEnabled]);

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;

    if (key.name === "f1") {
      key.preventDefault();
      setView("graph");
      return;
    }
    if (key.name === "f2") {
      key.preventDefault();
      setView("workspace");
      return;
    }
    if (key.name === "f3") {
      key.preventDefault();
      setView("timeline");
      return;
    }
    if (view === "timeline") {
      if ((key.name === "up" || key.name === "k") && timeline.length > 0) {
        key.preventDefault();
        setReplayEnabled(true);
        setReplayIndex((current) => Math.max(0, current - 1));
      } else if ((key.name === "down" || key.name === "j") && timeline.length > 0) {
        key.preventDefault();
        setReplayEnabled(true);
        setReplayIndex((current) => Math.min(timeline.length - 1, current + 1));
      } else if (key.name === "r") {
        key.preventDefault();
        setReplayEnabled((current) => !current);
      } else if (key.name === "g") {
        key.preventDefault();
        void loadSnapshot();
      } else if ((key.name === "return" || key.name === "enter") && currentEvent?.filePaths[0]) {
        key.preventDefault();
        setWorkspacePath(currentEvent.filePaths[0]);
        setView("workspace");
      }
      return;
    }
    if (view !== "graph" || sortedNodes.length === 0) return;

    if (key.name === "up" || key.name === "k") {
      key.preventDefault();
      const next = Math.max(0, selectedIndex - 1);
      setSelectedNodeId(sortedNodes[next]?.id ?? null);
      if (next < (scrollRef.current?.scrollTop ?? 0)) scrollRef.current?.scrollTo(next);
    } else if (key.name === "down" || key.name === "j") {
      key.preventDefault();
      const next = Math.min(sortedNodes.length - 1, selectedIndex + 1);
      setSelectedNodeId(sortedNodes[next]?.id ?? null);
      const viewport = scrollRef.current?.viewport.height ?? 1;
      if (next >= (scrollRef.current?.scrollTop ?? 0) + viewport) {
        scrollRef.current?.scrollTo(next - viewport + 1);
      }
    } else if (key.name === "left" && timeline.length > 0) {
      key.preventDefault();
      setReplayEnabled(true);
      setReplayIndex((current) => Math.max(0, current - 1));
    } else if (key.name === "right" && timeline.length > 0) {
      key.preventDefault();
      setReplayEnabled(true);
      setReplayIndex((current) => Math.min(timeline.length - 1, current + 1));
    } else if (key.name === "r") {
      key.preventDefault();
      setReplayEnabled((current) => !current);
    } else if (key.name === "g") {
      key.preventDefault();
      void loadSnapshot();
    } else if ((key.name === "return" || key.name === "enter") && selectedNode?.kind === "file") {
      key.preventDefault();
      setWorkspacePath(selectedNode.path);
      setView("workspace");
    }
  });

  if (!sessionId) {
    return (
      <box flexDirection="column" flexGrow={1} minHeight={0} gap={1}>
        <box flexDirection="row" justifyContent="space-between" border={["bottom"]} borderColor={colors.dimSeparator} paddingBottom={1}>
          <text attributes={TextAttributes.BOLD} fg={colors.primary}>Workspace</text>
          <text attributes={TextAttributes.DIM}>No active session · local workspace only</text>
        </box>
        <NeoLensWorkspacePanel activityPaths={EMPTY_PATHS} />
      </box>
    );
  }
  if (error) {
    return (
      <box flexDirection="column" flexGrow={1} minHeight={0} gap={1}>
        <box flexDirection="row" justifyContent="space-between" border={["bottom"]} borderColor={colors.dimSeparator} paddingBottom={1}>
          <text fg={colors.error}>Activity unavailable: {error}</text>
          <text attributes={TextAttributes.DIM}>local workspace remains available</text>
        </box>
        <NeoLensWorkspacePanel activityPaths={activityPaths} />
      </box>
    );
  }
  if (!snapshot) {
    return <text attributes={TextAttributes.DIM}>Building the TypeScript dependency graph...</text>;
  }

  const graphHeight = Math.max(6, dimensions.height - 11);
  const currentEvent = timeline[replayIndex];
  const completedEvents = timeline.filter((event) => event.phase === "completed");
  const failedEvents = completedEvents.filter((event) => event.status === "failed");
  const modifiedPaths = new Set(
    completedEvents.filter((event) => event.status === "modified").flatMap((event) => event.filePaths),
  );
  const fallbackDurationMs = timeline.reduce((maximum, event) => Math.max(maximum, event.offsetMs), 0);
  const durationMs = snapshot.metrics.durationMs || fallbackDurationMs;

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} gap={1}>
      <box flexDirection="row" gap={1} border={["bottom"]} borderColor={colors.dimSeparator} paddingBottom={1}>
        <text
          fg={view === "graph" ? colors.primary : undefined}
          attributes={view === "graph" ? TextAttributes.BOLD : TextAttributes.DIM}
          onMouseDown={() => setView("graph")}
        >
          F1 Graph
        </text>
        <text attributes={TextAttributes.DIM}>·</text>
        <text
          fg={view === "workspace" ? colors.primary : undefined}
          attributes={view === "workspace" ? TextAttributes.BOLD : TextAttributes.DIM}
          onMouseDown={() => setView("workspace")}
        >
          F2 Workspace
        </text>
        <text attributes={TextAttributes.DIM}>·</text>
        <text
          fg={view === "timeline" ? colors.primary : undefined}
          attributes={view === "timeline" ? TextAttributes.BOLD : TextAttributes.DIM}
          onMouseDown={() => setView("timeline")}
        >
          F3 Timeline
        </text>
        <box flexGrow={1} />
        <text attributes={TextAttributes.DIM}>trace v{snapshot.traceSchemaVersion} · local source boundary</text>
      </box>

      {view === "workspace" ? (
        <NeoLensWorkspacePanel activityPaths={activityPaths} initialPath={workspacePath} />
      ) : view === "timeline" ? (
        <box flexDirection="column" flexGrow={1} minHeight={0} gap={1}>
          <box flexDirection="row" justifyContent="space-between">
            <text>
              <span fg={replayEnabled ? colors.info : colors.success}>● {replayEnabled ? "REPLAY" : "LIVE"}</span>
              <span attributes={TextAttributes.DIM}>{` · ${completedEvents.length} completed events`}</span>
            </text>
            <text attributes={TextAttributes.DIM}>{snapshot.cwd}</text>
          </box>
          <box flexDirection="row" gap={3} paddingY={1}>
            <text><span fg={colors.primary}>{modifiedPaths.size}</span> files changed</text>
            <text><span fg={failedEvents.length ? colors.error : colors.success}>{failedEvents.length}</span> failures</text>
            <text><span fg={colors.info}>{formatDuration(durationMs)}</span> elapsed</text>
            <text><span fg={colors.info}>{formatTokens(snapshot.metrics.totalTokens)}</span> tokens</text>
            <text><span fg={colors.success}>{formatCost(snapshot.metrics.estimatedCostUsd)}</span> est.</text>
          </box>
          <text attributes={TextAttributes.DIM}>
            {snapshot.metrics.models.length > 0
              ? `${snapshot.metrics.modelRuns} model runs · ${snapshot.metrics.models.join(", ")} · ${formatTokens(snapshot.metrics.inputTokens)} in / ${formatTokens(snapshot.metrics.outputTokens)} out`
              : "Model usage will appear after a completed generation."}
          </text>
          <scrollbox height={Math.max(6, dimensions.height - 14)}>
            {timeline.length === 0 ? (
              <text attributes={TextAttributes.DIM}>Waiting for agent tool activity.</text>
            ) : timeline.map((event, index) => {
              const selected = index === replayIndex;
              const color = event.status === "failed"
                ? colors.error
                : event.status === "verified"
                  ? colors.success
                  : event.status === "modified"
                    ? colors.primary
                    : colors.info;
              return (
                <box
                  key={event.id}
                  height={1}
                  paddingX={1}
                  backgroundColor={selected ? colors.selection : undefined}
                  onMouseMove={() => setReplayIndex(index)}
                >
                  <text selectable={false} fg={selected ? "black" : color}>
                    {String(index + 1).padStart(3)}  {STATUS_ICON[event.status]} {formatDuration(event.offsetMs).padStart(8)}  {event.summary}
                    <span attributes={TextAttributes.DIM}> · {event.phase} · {event.toolName}</span>
                  </text>
                </box>
              );
            })}
          </scrollbox>
          <text attributes={TextAttributes.DIM}>↑↓/jk replay events · enter open file · r live/replay · g refresh · F1 graph · F2 workspace</text>
        </box>
      ) : (
      <>
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={replayEnabled ? colors.info : colors.success}>● {replayEnabled ? "REPLAY" : "LIVE"}</span>
          <span attributes={TextAttributes.DIM}> · {nodes.length} nodes · {edges.length} edges</span>
        </text>
        <text attributes={TextAttributes.DIM}>
          {snapshot.graph.truncated ? "first 500 files · " : ""}{snapshot.cwd}
        </text>
      </box>

      <box flexDirection="row" flexGrow={1} minHeight={0} gap={2}>
        <box width="60%" flexDirection="column" border={["right"]} borderColor={colors.dimSeparator} paddingRight={1}>
          <text attributes={TextAttributes.BOLD}>Dependency graph</text>
          <scrollbox ref={scrollRef} height={graphHeight}>
            {sortedNodes.map((node, index) => {
              const selected = index === selectedIndex;
              const status = statusByNode.get(node.id);
              const targets = edges.filter((edge) => edge.source === node.id);
              const color = status === "failed"
                ? colors.error
                : status === "verified"
                  ? colors.success
                  : status === "modified"
                    ? colors.primary
                    : status === "inspected"
                      ? colors.info
                      : undefined;
              const label = node.kind === "mcp" ? `MCP · ${node.label}` : node.id;
              const connection = targets.length > 0
                ? ` → ${targets.slice(0, 2).map((edge) => edge.target).join(", ")}${targets.length > 2 ? ` +${targets.length - 2}` : ""}`
                : "";

              return (
                <box
                  key={node.id}
                  height={1}
                  paddingX={1}
                  backgroundColor={selected ? colors.selection : undefined}
                  onMouseMove={() => setSelectedNodeId(node.id)}
                >
                  <text selectable={false} fg={selected ? "black" : color}>
                    {status ? STATUS_ICON[status] : node.kind === "mcp" ? "◇" : "○"} {label}
                    <span attributes={TextAttributes.DIM}>{connection}</span>
                  </text>
                </box>
              );
            })}
          </scrollbox>
        </box>

        <box width="40%" flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD}>Node details</text>
          {selectedNode ? (
            <>
              <text fg={statusByNode.has(selectedNode.id) ? colors.primary : undefined}>{selectedNode.id}</text>
              <text attributes={TextAttributes.DIM}>
                {selectedNode.kind === "mcp"
                  ? `${selectedNode.transport} · ${selectedNode.status}`
                  : `${outgoing.length} imports · ${incoming.length} dependents`}
              </text>
              {selectedActivity ? (
                <text>{STATUS_ICON[selectedActivity.status]} {selectedActivity.summary}</text>
              ) : (
                <text attributes={TextAttributes.DIM}>No agent activity yet.</text>
              )}
              <box flexDirection="column" paddingTop={1}>
                <text attributes={TextAttributes.BOLD}>Connections</text>
                {[...outgoing, ...incoming].slice(0, 8).map((edge) => (
                  <text key={`${edge.source}:${edge.target}:${edge.kind}`} attributes={TextAttributes.DIM}>
                    {edge.source === selectedNode.id ? "→" : "←"} {edge.source === selectedNode.id ? edge.target : edge.source}
                  </text>
                ))}
                {outgoing.length + incoming.length === 0 ? (
                  <text attributes={TextAttributes.DIM}>No resolved TypeScript imports.</text>
                ) : null}
              </box>
            </>
          ) : null}
        </box>
      </box>

      <box flexDirection="column" border={["top"]} borderColor={colors.dimSeparator} paddingTop={1}>
        <text>
          Timeline {timeline.length === 0 ? "0/0" : `${replayIndex + 1}/${timeline.length}`}
          <span attributes={TextAttributes.DIM}> · {currentEvent?.summary ?? "Waiting for agent tool activity"}</span>
        </text>
        <text attributes={TextAttributes.DIM}>↑↓/jk navigate · enter open file · ←→ replay · r live/replay · g refresh · esc close</text>
      </box>
      </>
      )}
    </box>
  );
}

const EMPTY_PATHS = new Set<string>();

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${durationMs}ms`;
  const seconds = durationMs / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatTokens(tokens: number) {
  if (tokens < 1_000) return String(tokens);
  if (tokens < 1_000_000) return `${(tokens / 1_000).toFixed(tokens < 10_000 ? 1 : 0)}k`;
  return `${(tokens / 1_000_000).toFixed(1)}m`;
}

function formatCost(cost: number) {
  if (cost === 0) return "$0.00";
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}
