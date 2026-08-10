import { z } from "zod";
import { tool } from "ai";

export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
} as const;

export const modeSchema = z.enum([Mode.BUILD, Mode.PLAN]);

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const toolInputSchemas = {
  readFile: z.object({
    path: z.string().describe("Relative path to the file to read"),
  }),
  listDirectory: z.object({
    path: z.string().default(".").describe("Relative directory path to list"),
  }),
  glob: z.object({
    pattern: z.string().describe("Glob pattern to match files"),
    path: z.string().default(".").describe("Directory to search from"),
  }),
  grep: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().default(".").describe("Directory to search from"),
    include: z.string().optional().describe("Optional glob for files to include"),
  }),
  writeFile: z.object({
    path: z.string().describe("Relative path to write"),
    content: z.string().describe("File contents"),
  }),
  editFile: z.object({
    path: z.string().describe("Relative path to edit"),
    oldString: z.string().describe("Exact text to replace; must be unique"),
    newString: z.string().describe("Replacement text"),
  }),
  bash: z.object({
    command: z.string().describe("Shell command to run"),
    description: z.string().optional().describe("Short description of the command"),
    timeout: z.number().optional().describe("Timeout in milliseconds"),
  }),
};

const readOnlyToolContracts = {
  readFile: tool({
    description: "Read the contents of a file in the project",
    inputSchema: toolInputSchemas.readFile,
  }),
  listDirectory: tool({
    description: "List files and directories in a project directory",
    inputSchema: toolInputSchemas.listDirectory,
  }),
  glob: tool({
    description: "Find project files matching a glob pattern",
    inputSchema: toolInputSchemas.glob,
  }),
  grep: tool({
    description: "Search project files for a regular expression",
    inputSchema: toolInputSchemas.grep,
  }),
};

const buildToolContracts = {
  ...readOnlyToolContracts,
  writeFile: tool({
    description: "Create or overwrite a file in the project",
    inputSchema: toolInputSchemas.writeFile,
  }),
  editFile: tool({
    description: "Replace one unique text occurrence in a project file",
    inputSchema: toolInputSchemas.editFile,
  }),
  bash: tool({
    description: "Run a shell command in the project directory",
    inputSchema: toolInputSchemas.bash,
  }),
};

export type ToolContracts = typeof buildToolContracts;

export function getToolContracts(mode: ModeType) {
  return mode === Mode.PLAN ? readOnlyToolContracts : buildToolContracts;
}

// Keep the explicit key schema here because the one-argument z.record(...)
// form does not type-check cleanly with the Zod typings used in this workspace.
export const toolCallArgsSchema = z.record(z.string(), z.json());

export const neoLensFileStatusSchema = z.enum([
  "inspected",
  "modified",
  "failed",
  "verified",
]);

export const neoLensActivityEventSchema = z.object({
  id: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
  phase: z.enum(["started", "completed"]),
  status: neoLensFileStatusSchema,
  filePaths: z.array(z.string()),
  mcpServer: z.string().optional(),
  timestampMs: z.number().nonnegative(),
  offsetMs: z.number().nonnegative(),
  summary: z.string(),
});

export type NeoLensFileStatus = z.infer<typeof neoLensFileStatusSchema>;
export type NeoLensActivityEvent = z.infer<typeof neoLensActivityEventSchema>;

export const messagePartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("reasoning"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool-call"),
    id: z.string(),
    name: z.string(),
    args: toolCallArgsSchema,
    result: z.string().optional(),
    activity: z
      .object({
        started: neoLensActivityEventSchema,
        completed: neoLensActivityEventSchema.optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
]);

export const messagePartsSchema = z.array(messagePartSchema);

export type MessagePart = z.infer<typeof messagePartSchema>;

// Tool-call args stay as nested JSON on the wire so the client does not need
// a second JSON.parse step after decoding the SSE event payload itself.
export const chatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    args: toolCallArgsSchema,
  }),
  z.object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    result: z.string(),
  }),
  z.object({
    type: z.literal("neolens-activity"),
    event: neoLensActivityEventSchema,
  }),
  z.object({
    type: z.literal("done"),
    messageId: z.string(),
    durationMs: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
