export const PAPERCLIP_OFFICIAL_MASTER_COMMIT = "1afb6be961550694ca9d537cc97a27306950edab";
export const PAPERCLIP_MINIMUM_STABLE_VERSION = "2026.416.0";
export const PAPERCLIP_MINIMUM_STABLE_COMMIT = "b8725c52eff66cdea8cb223f1ca885475a254468";
export const WORKFLOW_SCHEMA_VERSION = "paperclip-workflow-studio/v1";
export const WORKFLOW_COMPILER_VERSION = "paperclip-workflow-studio-compiler/v1";
export const WORKFLOW_MAX_NODES = 100;

export const WORKFLOW_NODE_TYPES = [
  "start",
  "end",
  "prompt",
  "subAgent",
  "askUserQuestion",
  "ifElse",
  "switch",
  "skill",
  "mcp",
  "subAgentFlow",
  "codex",
  "group",
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export type PublishStateStatus =
  | "unpublished"
  | "published"
  | "dirty"
  | "external_drift"
  | "publish_error";

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowPosition;
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
}

export interface StructuredOverrides {
  introOverride?: string | null;
  constraintsOverride?: string | null;
  notesOverride?: string | null;
}

export interface WorkflowPublishState {
  status: PublishStateStatus;
  companySkillId?: string | null;
  generatedHash?: string | null;
  compilerVersion?: string | null;
  publishedAt?: string | null;
  error?: string | null;
}

export interface WorkflowDefinition {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  schemaVersion: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  structuredOverrides: StructuredOverrides;
  publishState: WorkflowPublishState;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SkillArtifact {
  skillMarkdown: string;
  referenceMarkdown: string;
  generatedHash: string;
  compilerVersion: string;
  metadata: {
    workflowId: string;
    workflowSchemaVersion: string;
    generatedHash: string;
    compilerVersion: string;
    publishedByPlugin: string;
  };
}

export interface WorkflowListResult {
  workflows: WorkflowDefinition[];
}

export interface WorkflowDetailResult {
  workflow: WorkflowDefinition | null;
}

export interface WorkflowPreviewResult {
  workflow: WorkflowDefinition;
  artifact: SkillArtifact;
}

export interface WorkflowCreateInput {
  companyId: string;
  name: string;
  slug?: string | null;
  description?: string | null;
}

export interface WorkflowUpdateInput {
  companyId: string;
  workflow: WorkflowDefinition;
}

export interface WorkflowUpdateResult {
  workflow: WorkflowDefinition;
  artifact: SkillArtifact;
}

export interface WorkflowDeleteInput {
  companyId: string;
  workflowId: string;
}

export interface WorkflowPublishInput {
  companyId: string;
  workflowId: string;
  companySkillId: string;
  generatedHash: string;
  currentPublishedHash?: string | null;
  force?: boolean;
}
