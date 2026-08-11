import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import {
  buildWorkspaceIndex,
  readWorkspaceFile,
  searchWorkspace,
  type NeoLensFilePreview,
  type NeoLensSearchMatch,
  type NeoLensWorkspaceIndex,
} from "@neocode/shared";
import { useKeyboardLayer } from "../../providers/keyboard-layer";
import { useTheme } from "../../providers/theme";

const MAX_RENDERED_CODE_LINES = 2_500;

type WorkspaceRow = {
  key: string;
  path: string;
  line: number | null;
  label: string;
};

export function NeoLensWorkspacePanel({
  activityPaths,
  initialPath,
}: {
  activityPaths: ReadonlySet<string>;
  initialPath?: string | null;
}) {
  const cwd = process.cwd();
  const [index, setIndex] = useState<NeoLensWorkspaceIndex | null>(null);
  const [preview, setPreview] = useState<NeoLensFilePreview | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewLine, setPreviewLine] = useState(0);
  const [focus, setFocus] = useState<"files" | "code">("files");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchMatches, setSearchMatches] = useState<NeoLensSearchMatch[]>([]);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<ScrollBoxRenderable>(null);
  const searchGeneration = useRef(0);
  const openedInitialPath = useRef<string | null>(null);
  const { isTopLayer } = useKeyboardLayer();
  const { colors } = useTheme();
  const dimensions = useTerminalDimensions();

  const loadIndex = useCallback(async () => {
    setError(null);
    try {
      const value = await buildWorkspaceIndex(cwd);
      setIndex(value);
      setSelectedIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to index workspace");
    }
  }, [cwd]);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (!index || query.trim().length < 2) {
      setSearchMatches([]);
      setSearchTruncated(false);
      setSearching(false);
      return;
    }
    const generation = ++searchGeneration.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchWorkspace(cwd, index.files, query)
        .then((result) => {
          if (generation !== searchGeneration.current) return;
          setSearchMatches(result.matches);
          setSearchTruncated(result.truncated);
        })
        .catch((cause) => {
          if (generation === searchGeneration.current) {
            setError(cause instanceof Error ? cause.message : "Workspace search failed");
          }
        })
        .finally(() => {
          if (generation === searchGeneration.current) setSearching(false);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [cwd, index, query]);

  const rows = useMemo<WorkspaceRow[]>(() => {
    if (!index) return [];
    if (query.trim().length >= 2) {
      return searchMatches.map((match, position) => ({
        key: `${match.path}:${match.line ?? "path"}:${position}`,
        path: match.path,
        line: match.line,
        label: match.line ? `${match.path}:${match.line}` : match.path,
      }));
    }
    return index.files.map((path) => ({ key: path, path, line: null, label: path }));
  }, [index, query, searchMatches]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const openRow = useCallback(async (row: WorkspaceRow | undefined) => {
    if (!row) return;
    setError(null);
    try {
      const value = await readWorkspaceFile(cwd, row.path);
      setPreview(value);
      const targetLine = Math.max(0, (row.line ?? 1) - 1);
      setPreviewLine(targetLine);
      previewRef.current?.scrollTo(targetLine);
      setFocus("code");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to open file");
    }
  }, [cwd]);

  useEffect(() => {
    if (!index || !initialPath || openedInitialPath.current === initialPath) return;
    const position = index.files.indexOf(initialPath);
    if (position === -1) return;
    openedInitialPath.current = initialPath;
    setQuery("");
    setSelectedIndex(position);
    void openRow({ key: initialPath, path: initialPath, line: null, label: initialPath });
  }, [index, initialPath, openRow]);

  const codeLines = useMemo(
    () => preview?.content.split("\n").slice(0, MAX_RENDERED_CODE_LINES) ?? [],
    [preview],
  );
  const codeViewportHeight = Math.max(4, dimensions.height - 15);

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;
    if (searchMode) {
      if (key.name === "return" || key.name === "enter") {
        key.preventDefault();
        setSearchMode(false);
      } else if (key.name === "backspace" || key.name === "delete") {
        key.preventDefault();
        setQuery((current) => current.slice(0, -1));
      } else if (key.name === "space") {
        key.preventDefault();
        setQuery((current) => `${current} `);
      } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        key.preventDefault();
        setQuery((current) => `${current}${key.sequence}`);
      }
      return;
    }

    if (key.sequence === "/") {
      key.preventDefault();
      setSearchMode(true);
      setFocus("files");
    } else if (key.name === "tab") {
      key.preventDefault();
      setFocus((current) => current === "files" ? "code" : "files");
    } else if (key.name === "return" || key.name === "enter") {
      if (focus === "files") {
        key.preventDefault();
        void openRow(rows[selectedIndex]);
      }
    } else if (key.name === "g") {
      key.preventDefault();
      void loadIndex();
    } else if (key.name === "c" && query) {
      key.preventDefault();
      setQuery("");
      setSearchMatches([]);
    } else if (key.name === "up" || key.name === "k") {
      key.preventDefault();
      if (focus === "files") {
        setSelectedIndex((current) => Math.max(0, current - 1));
      } else {
        setPreviewLine((current) => {
          const next = Math.max(0, current - 1);
          previewRef.current?.scrollTo(next);
          return next;
        });
      }
    } else if (key.name === "down" || key.name === "j") {
      key.preventDefault();
      if (focus === "files") {
        setSelectedIndex((current) => rows.length === 0 ? 0 : Math.min(rows.length - 1, current + 1));
      } else {
        setPreviewLine((current) => {
          const next = Math.min(Math.max(0, codeLines.length - 1), current + 1);
          previewRef.current?.scrollTo(Math.max(0, next - codeViewportHeight + 1));
          return next;
        });
      }
    }
  });

  if (!index && !error) {
    return <text attributes={TextAttributes.DIM}>Indexing the local workspace...</text>;
  }

  const listHeight = Math.max(4, dimensions.height - 15);
  const listTextWidth = Math.max(14, Math.floor((dimensions.width - 8) * 0.38) - 4);
  const previewTitleWidth = Math.max(12, Math.floor((dimensions.width - 8) * 0.62) - 22);
  const windowStart = Math.max(0, Math.min(selectedIndex - Math.floor(listHeight / 2), rows.length - listHeight));
  const visibleRows = rows.slice(windowStart, windowStart + listHeight);

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={colors.success}>● LOCAL</span>
          <span attributes={TextAttributes.DIM}>
            {` · ${index?.files.length ?? 0} files · read-only`}
          </span>
        </text>
        <text attributes={TextAttributes.DIM}>
          {index?.truncated ? "index capped · " : ""}{index?.ignoredCount ?? 0} ignored
        </text>
      </box>

      <box height={1} paddingX={1} backgroundColor={searchMode ? colors.selection : undefined}>
        <text fg={searchMode ? "black" : undefined}>
          / {query || (searchMode ? "type to search files and content" : "search")}
          {searching ? "  …" : searchTruncated ? "  (limited)" : ""}
        </text>
      </box>

      {error ? <text fg={colors.error}>{error}</text> : null}

      <box flexDirection="row" flexGrow={1} minHeight={0} gap={2}>
        <box width="38%" flexDirection="column" border={["right"]} borderColor={colors.dimSeparator} paddingRight={1}>
          <text attributes={TextAttributes.BOLD} fg={focus === "files" ? colors.primary : undefined}>
            {query.trim().length >= 2 ? `Search results (${rows.length})` : "Workspace"}
          </text>
          {rows.length === 0 ? (
            <text attributes={TextAttributes.DIM}>{searching ? "Searching..." : "No matching files."}</text>
          ) : visibleRows.map((row, position) => {
            const absoluteIndex = windowStart + position;
            const selected = absoluteIndex === selectedIndex;
            const active = activityPaths.has(row.path);
            return (
              <box
                key={row.key}
                flexDirection="column"
                height={1}
                overflow="hidden"
                backgroundColor={selected ? colors.selection : undefined}
                paddingX={1}
                onMouseMove={() => setSelectedIndex(absoluteIndex)}
                onMouseDown={() => void openRow(row)}
              >
                <text selectable={false} fg={selected ? "black" : active ? colors.primary : undefined}>
                  {active ? "◆" : "·"} {truncateMiddle(row.label, listTextWidth)}
                </text>
              </box>
            );
          })}
        </box>

        <box width="62%" flexDirection="column" minHeight={0}>
          {preview ? (
            <>
              <box flexDirection="row" justifyContent="space-between">
                <text attributes={TextAttributes.BOLD} fg={focus === "code" ? colors.primary : undefined}>
                  {truncateMiddle(preview.path, previewTitleWidth)}
                </text>
                <text attributes={TextAttributes.DIM}>
                  {preview.language} · {formatBytes(preview.bytes)}{preview.truncated ? " · preview capped" : ""}
                </text>
              </box>
              <scrollbox ref={previewRef} height={codeViewportHeight}>
                {codeLines.map((line, index) => (
                  <box key={index} height={1} overflow="hidden" backgroundColor={focus === "code" && index === previewLine ? colors.selection : undefined}>
                    <text
                      selectable
                      fg={focus === "code" && index === previewLine ? "black" : undefined}
                    >
                      <span attributes={TextAttributes.DIM}>{String(index + 1).padStart(5)} │ </span>
                      {sanitizeTerminalText(line)}
                    </text>
                  </box>
                ))}
                {codeLines.length >= MAX_RENDERED_CODE_LINES ? (
                  <text attributes={TextAttributes.DIM}>… preview limited to {MAX_RENDERED_CODE_LINES} lines</text>
                ) : null}
              </scrollbox>
            </>
          ) : (
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text attributes={TextAttributes.DIM}>Select a file and press enter to inspect it.</text>
            </box>
          )}
        </box>
      </box>

      <box height={1} overflow="hidden">
        <text attributes={TextAttributes.DIM}>
          / search | enter open | tab pane | j/k move | c clear | g refresh | local only
        </text>
      </box>
    </box>
  );
}

function sanitizeTerminalText(value: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: terminal previews must strip unsafe control bytes
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "�");
}

function formatBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function truncateMiddle(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  if (maximum < 8) return value.slice(0, maximum);
  const left = Math.ceil((maximum - 1) / 2);
  const right = Math.floor((maximum - 1) / 2);
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}
