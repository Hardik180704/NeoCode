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

const STATUS_ICON: Record<NeoLensFileStatus, string> = {
  inspected: "◉",
  modified: "◆",
  failed: "×",
  verified: "✓",
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
    if (!isTopLayer("dialog") || sortedNodes.length === 0) return;

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
    }
  });

  if (!sessionId) {
    return <text attributes={TextAttributes.DIM}>Start or open a session to use NeoLens.</text>;
  }
  if (error) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg={colors.error}>{error}</text>
        <text attributes={TextAttributes.DIM}>Press g to retry.</text>
      </box>
    );
  }
  if (!snapshot) {
    return <text attributes={TextAttributes.DIM}>Building the TypeScript dependency graph...</text>;
  }

  const graphHeight = Math.max(6, dimensions.height - 11);
  const currentEvent = timeline[replayIndex];

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} gap={1}>
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
        <text attributes={TextAttributes.DIM}>↑↓/jk navigate · ←→ replay · r live/replay · g refresh · esc close</text>
      </box>
    </box>
  );
}
