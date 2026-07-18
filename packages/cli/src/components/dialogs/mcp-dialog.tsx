import { useEffect, useMemo, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { useParams } from "react-router";
import type { InferResponseType } from "hono/client";
import { apiClient } from "../../lib/api-client";
import { getErrorMessage } from "../../lib/http-errors";
import { DialogSearchList } from "../dialog-search-list";

type McpInspection = InferResponseType<(typeof apiClient.mcp)[":sessionId"]["$get"], 200>;
type McpServer = McpInspection["servers"][number];

const STATUS_ICON: Record<McpServer["status"], string> = {
  connected: "●",
  disabled: "○",
  failed: "×",
};

export function McpDialogContent() {
  const { id: sessionId } = useParams();
  const [inspection, setInspection] = useState<McpInspection | null>(null);
  const [selectedServerName, setSelectedServerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let ignore = false;

    const inspect = async () => {
      try {
        const response = await apiClient.mcp[":sessionId"].$get({
          param: { sessionId },
        });
        if (!response.ok) throw new Error(await getErrorMessage(response));

        const data = await response.json();
        if (ignore) return;
        setInspection(data);
        setSelectedServerName(data.servers[0]?.name ?? null);
      } catch (cause) {
        if (!ignore) {
          setError(cause instanceof Error ? cause.message : "Failed to inspect MCP servers");
        }
      }
    };

    void inspect();
    return () => {
      ignore = true;
    };
  }, [sessionId]);

  const selectedServer = useMemo(
    () => inspection?.servers.find((server) => server.name === selectedServerName) ?? null,
    [inspection, selectedServerName],
  );

  if (!sessionId) {
    return <text attributes={TextAttributes.DIM}>Start or open a session to inspect MCP servers.</text>;
  }

  if (error) {
    return <text fg="red">{error}</text>;
  }

  if (!inspection) {
    return <text attributes={TextAttributes.DIM}>Inspecting MCP servers...</text>;
  }

  if (!inspection.configured) {
    return (
      <box flexDirection="column" gap={1}>
        <text>No MCP configuration found.</text>
        <text attributes={TextAttributes.DIM}>{inspection.configPath}</text>
      </box>
    );
  }

  if (inspection.servers.length === 0) {
    return <text attributes={TextAttributes.DIM}>No MCP servers are configured.</text>;
  }

  return (
    <box flexDirection="column" gap={1}>
      <DialogSearchList
        items={inspection.servers}
        onSelect={(server) => setSelectedServerName(server.name)}
        onHighlight={(server) => setSelectedServerName(server.name)}
        filterFn={(server, query) => server.name.toLowerCase().includes(query.toLowerCase())}
        renderItem={(server, isSelected) => (
          <>
            <text selectable={false} fg={isSelected ? "black" : undefined}>
              {STATUS_ICON[server.status]} {server.name}
            </text>
            <box flexGrow={1} />
            <text
              selectable={false}
              fg={isSelected ? "black" : undefined}
              attributes={TextAttributes.DIM}
            >
              {server.status === "connected" ? `${server.tools.length} tools` : server.status}
            </text>
          </>
        )}
        getKey={(server) => server.name}
        placeholder="Search MCP servers"
        emptyText="No matching MCP servers"
      />

      {selectedServer && (
        <box flexDirection="column" paddingTop={1} gap={1}>
          <text>
            {selectedServer.serverInfo?.title ?? selectedServer.serverInfo?.name ?? selectedServer.name}
            <span attributes={TextAttributes.DIM}> · {selectedServer.transport}</span>
          </text>

          {selectedServer.error ? (
            <text fg="red">{selectedServer.error}</text>
          ) : selectedServer.tools.length === 0 ? (
            <text attributes={TextAttributes.DIM}>No tools available.</text>
          ) : (
            <box flexDirection="column">
              {selectedServer.tools.slice(0, 6).map((tool) => (
                <text key={tool.name} attributes={TextAttributes.DIM}>
                  {tool.access === "read" ? "R" : tool.access === "write" ? "W" : "-"} {tool.title ?? tool.name}
                </text>
              ))}
              {selectedServer.tools.length > 6 && (
                <text attributes={TextAttributes.DIM}>
                  +{selectedServer.tools.length - 6} more tools
                </text>
              )}
            </box>
          )}
        </box>
      )}
    </box>
  );
}
