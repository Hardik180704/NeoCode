import {useRef, useCallback, useEffect} from "react";
import { TextareaRenderable } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { EmptyBorder } from "./border";
import { StatusBar } from "./status-bar";
import { useNavigate } from "react-router";
import { type KeyBinding } from "@opentui/core";
import { CommandMenu } from "./command-menu";
import type { Command } from "./command-menu/types";
import { useCommandMenu } from "./command-menu/use-command-menu";
import { useToast } from "../providers/toast";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useDialog } from "../providers/dialog";
import { useTheme } from "../providers/theme";
import { usePromptConfig } from "../providers/prompt-config";
import { mode as Mode } from "@neocode/database/enums";

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "enter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "enter", shift: true, action: "newline" },
];

export function InputBar({ onSubmit, disabled = false }: Props) {
  const { mode, toggleMode, setMode, setModel } = usePromptConfig();
  const textareaRef = useRef<TextareaRenderable>(null);
  const onSubmitRef = useRef<() => void>(() => {});
  const renderer = useRenderer();
  const navigate = useNavigate();
  const toast = useToast();
  const dialog = useDialog();
  const { colors } = useTheme();
  const { isTopLayer, setResponder } = useKeyboardLayer();
  

  const {
    showCommandMenu,
    commandQuery,
    selectedIndex,
    scrollRef,
    handleContentChange,
    resolveCommand,
    setSelectedIndex,
  } = useCommandMenu();

  const handleTextareaContentChange = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return;

    handleContentChange(textarea.plainText);
  }, [handleContentChange])

  const handleSubmit = useCallback(() => {
    if (disabled) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.plainText.trim();
    if (text.length === 0) return;

    onSubmit(text);
    textarea.setText("");
  }, [disabled, onSubmit])

  const handleCommand = useCallback((command: Command | undefined) => {
    const textarea = textareaRef.current;
    if (!textarea || !command) return;

    textarea.setText("");

    if (command.action) {
      command.action({
        exit: () => renderer.destroy(),
        toast,
        dialog,
        navigate,
        mode, 
        setMode,
        setModel,
      });
    } else {
      textarea.insertText(command.value + " ");
    }
  }, [renderer, toast, dialog, navigate, mode, setMode, setModel]);

  const handleCommandExecute = useCallback((index: number) => {
    const command = resolveCommand(index);
    handleCommand(command);
  }, [resolveCommand, handleCommand]);

  // Wire up textarea submit handler once so it always reads the latest
  // state.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.onSubmit = () => {
      onSubmitRef.current();
    };
  }, []);

  onSubmitRef.current = () => {
    if (disabled) return;

    if (showCommandMenu) {
      const command = resolveCommand(selectedIndex);
      handleCommand(command);
      return;
    }

    handleSubmit();
  };

  useKeyboard((key) => {
    if (disabled) return;
    if (!isTopLayer("base")) return;
    if (key.name === "tab") {
      key.preventDefault();
      toggleMode();
    }
  });

  // Register base layer responder for ctrl + c dismissal
  useEffect(() => {
    setResponder("base", () => {
      if(disabled) return false;

      const textarea = textareaRef.current;
      if(textarea && textarea.plainText.length > 0) {
        textarea.setText("");
        return true;
      }
      return false;
    });

    return () => setResponder("base", null);
  }, [disabled, setResponder]);

  return (
    <box width="100%" alignItems="center">
      <box
        border={["left"]}
        borderColor={mode == Mode.BUILD ? colors.primary : colors.planMode}
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃",
          bottomLeft: "╹",
        }}
        width="100%"
      >
        <box
          position="relative"
          justifyContent="center"
          paddingX={2}
          paddingY={1}
          backgroundColor={colors.surface}
          width="100%"
          gap={1}
        >
          {showCommandMenu && (
            <box
              position="absolute"
              bottom="100%"
              left={0}
              width="100%"
              backgroundColor={colors.surface} 
              zIndex={10}
            >
              <CommandMenu
                query={commandQuery}
                selectedIndex={selectedIndex}
                scrollRef={scrollRef}
                onSelect={setSelectedIndex}
                onExecute={handleCommandExecute}
              />
            </box>
          )}
          <textarea
            ref = {textareaRef}
            focused={
              !disabled &&
              (
                isTopLayer("base") ||
                isTopLayer("command")
              )
            }
            keyBindings={TEXTAREA_KEY_BINDINGS}
            onContentChange={handleTextareaContentChange}
            placeholder={`Ask anything... "Fix a bug in the database"`}
          />
          <StatusBar />
        </box>
      </box>
    </box>
  );
}
