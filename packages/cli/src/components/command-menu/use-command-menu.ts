import { useRef, useState, useMemo, type RefObject } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { getFilteredCommands } from "./filter-commands";
import type { Command } from "./types";
import { useKeyboardLayer } from "../../providers/keyboard-layer";

type UseCommandMenuReturn = {
  showCommandMenu: boolean;
  commandQuery: string;
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  handleContentChange: (text: string) => void;
  resolveCommand: (index: number) => Command | undefined;
  setSelectedIndex: (index: number) => void;
};

export function useCommandMenu(): UseCommandMenuReturn {
  const [textValue, setTextValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const { push, pop, isTopLayer } = useKeyboardLayer();

  const commandQuery = showCommandMenu && textValue.startsWith("/") ? textValue.slice(1) : "";

  const filteredCommands = useMemo(() => getFilteredCommands(commandQuery), [commandQuery]);

  const close = () => {
    setShowCommandMenu(false);
    pop("command");
  };

  const handleContentChange = (text: string) => {
    setTextValue(text);
    setSelectedIndex(0);

    // Jump back to the top of the list when the user types a new character
    const scrollbox = scrollRef.current;
    if (scrollbox) {
      scrollbox.scrollTo(0);
    }

    const prefix = text.startsWith("/") ? text.slice(1) : null;
    if (prefix !== null && !prefix.includes(" ")) {
      setShowCommandMenu(true);
      push("command", () => {
        close();
        return true;
      })
    } else {
      close();
    }
  };

  // Resolve a command at a specific index (returns the command, caller handles execution)
  const resolveCommand = (index: number): Command | undefined => {
    const command = filteredCommands[index];
    if (command) {
      close();
    }
    return command;
  };

  // Arrow keys move selection; the list follows along when the highlight goes off-screen
  useKeyboard((key) => {
    if (!showCommandMenu || !isTopLayer("command")) return;

    if (key.name === "escape") {
      key.preventDefault();
      close();
    } else if (key.name === "up") {
      key.preventDefault();
      setSelectedIndex((i) => {
        const newIndex = Math.max(0, i - 1);
        // Keep the highlighted item visible when arrowing past the edge
        const sb = scrollRef.current;
        if (sb && newIndex < sb.scrollTop) {
          sb.scrollTo(newIndex);
        }
        return newIndex;
      });
    } else if (key.name === "down") {
      key.preventDefault();
      setSelectedIndex((i) => {
        if (filteredCommands.length === 0) {
          return 0;
        }

        const newIndex = Math.min(filteredCommands.length - 1, i + 1);
        const sb = scrollRef.current;
        if (sb) {
          const viewportHeight = sb.viewport.height;
          const visibleEnd = sb.scrollTop + viewportHeight - 1;
          if (newIndex > visibleEnd) {
            sb.scrollTo(newIndex - viewportHeight + 1);
          }
        }
        return newIndex;
      });
    }
  });

  return {
    showCommandMenu,
    commandQuery,
    selectedIndex,
    scrollRef,
    handleContentChange,
    resolveCommand,
    setSelectedIndex,
  };
}