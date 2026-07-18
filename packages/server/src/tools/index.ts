import type { mode as Mode } from "@neocode/database/enums";
import { createReadFileTool } from "./read-file";
import { createListDirectoryTool } from "./list-directory";
import { createWriteFileTool } from "./write-file";
import { createEditFileTool } from "./edit-file";
import { createGrepTool } from "./grep";
import { createGlobTool } from "./glob";
import { createBashTool } from "./bash";
import { createMcpRuntime } from "../mcp/runtime";

export function createTools(cwd: string, mode: Mode) {
  const readOnlyTools = {
    readFile: createReadFileTool(cwd),
    listDirectory: createListDirectoryTool(cwd),
    grep: createGrepTool(cwd),
    glob: createGlobTool(cwd),
  };

  if (mode === "PLAN") {
    return readOnlyTools;
  }

  return {
    ...readOnlyTools,
    writeFile: createWriteFileTool(cwd),
    editFile: createEditFileTool(cwd),
    bash: createBashTool(cwd),
  };
}

export async function createToolRuntime(params: {
  cwd: string;
  mode: Mode;
  abortSignal: AbortSignal;
}) {
  const localTools = createTools(params.cwd, params.mode);
  const mcp = await createMcpRuntime({
    cwd: params.cwd,
    mode: params.mode,
    abortSignal: params.abortSignal,
  });

  return {
    tools: { ...localTools, ...mcp.tools },
    warnings: mcp.warnings,
    close: mcp.close,
  };
}
