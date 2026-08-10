import type { Command } from "./types";
import {
  AgentsDialogContent,
  ThemeDialogContent,
  SessionsDialogContent,
  ModelsDialogContent,
  McpDialogContent,
  NeoLensDialogContent,
} from "../dialogs";
import { SUPPORTED_CHAT_MODELS } from "@neocode/shared";
import { performLogin } from "../../lib/oauth";
import { clearAuth } from "../../lib/auth";
import { openBillingPortal, openUpgradeCheckout } from "../../lib/upgrade";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.navigate("/");
    }
  },
  {
    name: "agents",
    description: "Switch agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Agent",
        children: <AgentsDialogContent currentMode={ctx.mode} onSelectMode={ctx.setMode} />,
      });
    },
  },
  {
    name: "models",
    description: "Select AI model for generation",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Model",
        children: (
          <ModelsDialogContent
            models={SUPPORTED_CHAT_MODELS.map((model) => model.id)}
            onSelectModel={ctx.setModel}
          />
        ),
      });
    },
  },
  {
    name: "sessions",
    description: "Browse past sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Sessions",
        children: <SessionsDialogContent />,
      });
    },
  },
  {
    name: "lens",
    description: "Watch and replay agent activity across the dependency graph",
    value: "/lens",
    action: (ctx) => {
      ctx.dialog.open({
        title: "NeoLens",
        size: "fullscreen",
        children: <NeoLensDialogContent />,
      });
    },
  },
  {
    name: "mcp",
    description: "Inspect configured MCP servers and tools",
    value: "/mcp",
    action: (ctx) => {
      ctx.dialog.open({
        title: "MCP Control Center",
        children: <McpDialogContent />,
      });
    },
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Theme",
        children: <ThemeDialogContent />,
      });
    },
  },
  {
    name: "login",
    description: "Sign in with your browser",
    value: "/login",
    action: async (ctx) => {
      ctx.toast.show({ message: "Opening browser to sign in..." });
      try {
        await performLogin();
        ctx.toast.show({ variant: "success", message: "Signed in successfully!" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sign in failed or timed out";
        ctx.toast.show({ variant: "error", message });
      }
    },
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
    action: (ctx) => {
      clearAuth();
      ctx.toast.show({ variant: "success", message: "Signed out" });
    },
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
    action: async (ctx) => {
      ctx.toast.show({ message: "Opening credits checkout..." });
      try {
        await openUpgradeCheckout();
        ctx.toast.show({ variant: "success", message: "Checkout opened in browser" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open checkout";
        ctx.toast.show({ variant: "error", message });
      }
    },
  },
  {
    name: "usage",
    description: "Open billing portal in your browser",
    value: "/usage",
    action: async (ctx) => {
      ctx.toast.show({ message: "Opening billing portal..." });
      try {
        await openBillingPortal();
        ctx.toast.show({ variant: "success", message: "Billing portal opened in browser" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open billing portal";
        ctx.toast.show({ variant: "error", message });
      }
    },
  },
  {
    name: "exit",
    description: "Quit the application",
    value: "/exit",
    action: (ctx) => {
      ctx.exit();
    },
  },
];
