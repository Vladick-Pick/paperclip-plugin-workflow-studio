import {
  SOURCE_NODE_TYPES,
  SOURCE_SCHEMA_VERSION,
  WORKFLOW_MAX_NODES,
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowCreateInput,
  type WorkflowDefinition,
  type WorkflowNodeType,
  type WorkflowValidationResult,
} from "./types.js";

const NODE_TYPE_SET = new Set<string>(SOURCE_NODE_TYPES);

export function normalizeSlug(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "workflow";
}

export function createStarterWorkflow(input: WorkflowCreateInput): WorkflowDefinition {
  const now = new Date().toISOString();
  const slug = normalizeSlug(input.slug ?? input.name);

  return {
    id: cryptoRandomId(),
    companyId: input.companyId,
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    sourceSchemaVersion: SOURCE_SCHEMA_VERSION,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "Start" } },
      {
        id: "prompt",
        type: "prompt",
        position: { x: 260, y: 0 },
        data: {
          label: "Instructions",
          prompt: `Run the ${input.name.trim()} workflow and produce a concise result.`,
        },
      },
      { id: "end", type: "end", position: { x: 520, y: 0 }, data: { label: "End" } },
    ],
    edges: [
      { id: "start-to-prompt", source: "start", target: "prompt" },
      { id: "prompt-to-end", source: "prompt", target: "end" },
    ],
    structuredOverrides: {
      introOverride: null,
      constraintsOverride: null,
      notesOverride: null,
    },
    publishState: { status: "unpublished" },
    createdAt: now,
    updatedAt: now,
  };
}

export function validateWorkflowDefinition(workflow: WorkflowDefinition): WorkflowValidationResult {
  const errors: string[] = [];

  if (!workflow.companyId?.trim()) errors.push("companyId is required");
  if (!workflow.name?.trim()) errors.push("name is required");
  if (!workflow.slug?.trim()) errors.push("slug is required");
  if (workflow.schemaVersion !== WORKFLOW_SCHEMA_VERSION) {
    errors.push(`Unsupported workflow schemaVersion: ${workflow.schemaVersion}`);
  }
  if (workflow.sourceSchemaVersion !== SOURCE_SCHEMA_VERSION) {
    errors.push(`Unsupported sourceSchemaVersion: ${workflow.sourceSchemaVersion}`);
  }
  if (workflow.nodes.length > WORKFLOW_MAX_NODES) {
    errors.push(`Workflow exceeds max node count: ${WORKFLOW_MAX_NODES}`);
  }

  const nodeIds = new Set<string>();
  let startCount = 0;
  let endCount = 0;

  for (const node of workflow.nodes) {
    if (!node.id?.trim()) {
      errors.push("Node id is required");
      continue;
    }
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);

    if (!NODE_TYPE_SET.has(node.type)) {
      errors.push(`Unsupported node type: ${String(node.type)}`);
    }
    if (node.type === "start") startCount += 1;
    if (node.type === "end") endCount += 1;
  }

  if (startCount !== 1) errors.push("Workflow must contain exactly one start node");
  if (endCount < 1) errors.push("Workflow must contain at least one end node");

  for (const edge of workflow.edges) {
    if (!edge.id?.trim()) errors.push("Edge id is required");
    if (!nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} has unknown source: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} has unknown target: ${edge.target}`);
  }

  return { valid: errors.length === 0, errors };
}

export function isWorkflowNodeType(value: string): value is WorkflowNodeType {
  return NODE_TYPE_SET.has(value);
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
