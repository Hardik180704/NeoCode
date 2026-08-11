export {
  SUPPORTED_CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  findSupportedChatModel,
  type ModelPricing,
  type SupportedProvider,
  type SupportedChatModel,
  type SupportedChatModelId,
} from "./models";

export {
  Mode,
  modeSchema,
  toolInputSchemas,
  getToolContracts,
  type ToolContracts,
  type ModeType,
  toolCallArgsSchema,
  messagePartSchema,
  messagePartsSchema,
  chatStreamEventSchema,
  neoLensActivityEventSchema,
  neoLensFileStatusSchema,
  type MessagePart,
  type ChatStreamEvent,
  type NeoLensActivityEvent,
  type NeoLensFileStatus,
} from "./schemas";

export {
  buildTypeScriptDependencyGraph,
  assertSafeGraphRoot,
  extractTypeScriptImports,
  resolveImportPath,
  type NeoLensExternalNode,
  type NeoLensFileNode,
  type NeoLensGraph,
  type NeoLensGraphEdge,
} from "./neolens-graph";

export {
  assertSafeWorkspaceRoot,
  buildWorkspaceIndex,
  readWorkspaceFile,
  searchWorkspace,
  type NeoLensFilePreview,
  type NeoLensSearchMatch,
  type NeoLensSearchResult,
  type NeoLensWorkspaceEntry,
  type NeoLensWorkspaceIndex,
} from "./neolens-workspace";

export const NEOLENS_TRACE_SCHEMA_VERSION = 1 as const;
