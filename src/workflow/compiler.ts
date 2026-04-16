import { createHash } from "node:crypto";
import {
  SOURCE_SCHEMA_COMMIT,
  WORKFLOW_COMPILER_VERSION,
  type SkillArtifact,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
} from "./types.js";
import { validateWorkflowDefinition } from "./schema.js";

export function compileWorkflowToSkill(workflow: WorkflowDefinition): SkillArtifact {
  const validation = validateWorkflowDefinition(workflow);
  if (!validation.valid) {
    throw new Error(`Cannot compile invalid workflow: ${validation.errors.join("; ")}`);
  }

  const orderedNodes = orderNodes(workflow.nodes, workflow.edges);
  const draftBody = renderSkillMarkdown(workflow, orderedNodes, null);
  const referenceMarkdown = renderReferenceMap(workflow, orderedNodes);
  const generatedHash = hashArtifact(draftBody, referenceMarkdown);
  const body = renderSkillMarkdown(workflow, orderedNodes, generatedHash);

  return {
    skillMarkdown: body,
    referenceMarkdown,
    generatedHash,
    compilerVersion: WORKFLOW_COMPILER_VERSION,
    metadata: {
      workflowId: workflow.id,
      workflowSchemaVersion: workflow.schemaVersion,
      sourceSchemaVersion: workflow.sourceSchemaVersion,
      sourceSchemaCommit: SOURCE_SCHEMA_COMMIT,
      generatedHash,
      compilerVersion: WORKFLOW_COMPILER_VERSION,
      publishedByPlugin: "paperclip-plugin-workflow-studio",
    },
  };
}

function renderSkillMarkdown(
  workflow: WorkflowDefinition,
  orderedNodes: WorkflowNode[],
  generatedHash: string | null,
) {
  return [
    renderFrontmatter(workflow, generatedHash),
    "",
    `# ${workflow.name}`,
    "",
    workflow.description ?? "Generated from a Workflow Studio graph.",
    "",
    renderOverrideSection("Operator intro", workflow.structuredOverrides.introOverride),
    renderOverrideSection("Constraints", workflow.structuredOverrides.constraintsOverride),
    "## Workflow",
    "",
    ...orderedNodes.flatMap((node, index) => renderNode(node, index + 1)),
    renderOverrideSection("Notes", workflow.structuredOverrides.notesOverride),
    "## Completion Criteria",
    "",
    "- Follow the workflow path that best matches the task context.",
    "- Summarize decisions, blockers, and artifacts produced.",
    "- Escalate if required information is missing or a branch cannot be resolved.",
    "",
  ].filter((line) => line !== null).join("\n");
}

export function hashArtifact(skillMarkdown: string, referenceMarkdown: string): string {
  return createHash("sha256")
    .update(skillMarkdown)
    .update("\n--- references/workflow-map.md ---\n")
    .update(referenceMarkdown)
    .digest("hex");
}

function renderFrontmatter(workflow: WorkflowDefinition, generatedHash: string | null) {
  return [
    "---",
    `name: ${yamlScalar(workflow.slug)}`,
    `description: ${yamlScalar(workflow.description ?? workflow.name)}`,
    "metadata:",
    `  workflowId: ${yamlScalar(workflow.id)}`,
    `  workflowSchemaVersion: ${yamlScalar(workflow.schemaVersion)}`,
    `  sourceSchemaVersion: ${yamlScalar(workflow.sourceSchemaVersion)}`,
    `  sourceSchemaCommit: ${yamlScalar(SOURCE_SCHEMA_COMMIT)}`,
    ...(generatedHash ? [`  generatedHash: ${yamlScalar(generatedHash)}`] : []),
    `  compilerVersion: ${yamlScalar(WORKFLOW_COMPILER_VERSION)}`,
    "  publishedByPlugin: paperclip-plugin-workflow-studio",
    "---",
  ].join("\n");
}

function renderOverrideSection(title: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return [`## ${title}`, "", trimmed, ""].join("\n");
}

function renderNode(node: WorkflowNode, index: number): string[] {
  const title = asString(node.data.label) ?? asString(node.data.description) ?? node.type;
  const lines = [`### ${index}. ${node.type}: ${title}`, ""];

  switch (node.type) {
    case "start":
      lines.push("Start the workflow.", "");
      break;
    case "end":
      lines.push("End the workflow and return the final result.", "");
      break;
    case "prompt":
      lines.push(asString(node.data.prompt) ?? "Follow the prompt node instructions.", "");
      break;
    case "subAgent":
      lines.push(`Delegate to sub-agent: ${asString(node.data.description) ?? "Unnamed sub-agent"}.`);
      lines.push(`Agent definition: ${asString(node.data.agentDefinition) ?? "Not specified."}`);
      lines.push(`Task prompt: ${asString(node.data.prompt) ?? "Not specified."}`);
      appendOptional(lines, "Model", asString(node.data.model));
      appendOptional(lines, "Tools", asString(node.data.tools));
      lines.push("");
      break;
    case "askUserQuestion":
      lines.push(`Ask the user: ${asString(node.data.questionText) ?? "Question not specified."}`);
      renderOptions(node.data.options).forEach((line) => lines.push(line));
      lines.push("");
      break;
    case "ifElse":
    case "switch":
      lines.push("Choose the matching branch:");
      renderBranches(node.data.branches).forEach((line) => lines.push(line));
      lines.push("");
      break;
    case "skill":
      lines.push(`Use skill: ${asString(node.data.skillName) ?? asString(node.data.skillSlug) ?? "unspecified"}.`);
      appendOptional(lines, "Instructions", asString(node.data.instructions));
      lines.push("");
      break;
    case "mcp":
      lines.push(`Use MCP tool: ${formatMcpTool(node)}.`);
      if (node.data.arguments) {
        lines.push(`Arguments: ${stableJson(node.data.arguments)}`);
      }
      lines.push("");
      break;
    case "subAgentFlow":
      lines.push(`Reference sub-agent flow: ${asString(node.data.flowName) ?? asString(node.data.workflowId) ?? "unspecified"}.`);
      appendOptional(lines, "Instructions", asString(node.data.instructions));
      lines.push("");
      break;
    case "codex":
      lines.push("Run an OpenAI Codex CLI step.");
      appendOptional(lines, "Prompt", asString(node.data.prompt));
      appendOptional(lines, "Model", asString(node.data.model));
      lines.push("");
      break;
    case "group":
      lines.push(`Group context: ${asString(node.data.description) ?? asString(node.data.label) ?? "No group details."}`);
      lines.push("");
      break;
  }

  return lines;
}

function renderReferenceMap(workflow: WorkflowDefinition, orderedNodes: WorkflowNode[]) {
  const workflowForReference = {
    ...workflow,
    publishState: { status: workflow.publishState.status },
  };
  return [
    `# Workflow Map: ${workflow.name}`,
    "",
    `- Workflow ID: \`${workflow.id}\``,
    `- Workflow schema: \`${workflow.schemaVersion}\``,
    `- Source schema: \`${workflow.sourceSchemaVersion}\``,
    `- Source schema commit: \`${SOURCE_SCHEMA_COMMIT}\``,
    `- Compiler: \`${WORKFLOW_COMPILER_VERSION}\``,
    "",
    "## Ordered Nodes",
    "",
    ...orderedNodes.map((node, index) => `${index + 1}. \`${node.id}\` — \`${node.type}\``),
    "",
    "## Edges",
    "",
    ...(workflow.edges.length
      ? workflow.edges.map((edge) => `- \`${edge.source}\` -> \`${edge.target}\`${edge.label ? ` (${edge.label})` : ""}`)
      : ["- No edges declared."]),
    "",
    "## Raw Workflow",
    "",
    "```json",
    stableJson(workflowForReference),
    "```",
    "",
  ].join("\n");
}

function orderNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const edge of edges) {
    const current = outgoing.get(edge.source) ?? [];
    current.push(edge);
    outgoing.set(edge.source, current);
  }

  const visited = new Set<string>();
  const ordered: WorkflowNode[] = [];
  const queue = nodes.find((node) => node.type === "start") ? ["start"] : [];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    visited.add(id);
    ordered.push(node);
    for (const edge of outgoing.get(id) ?? []) queue.push(edge.target);
  }

  const remainder = nodes
    .filter((node) => !visited.has(node.id))
    .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y || left.id.localeCompare(right.id));

  return [...ordered, ...remainder];
}

function appendOptional(lines: string[], label: string, value: string | null) {
  if (value) lines.push(`${label}: ${value}`);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function renderOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return ["- No options specified."];
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") return `- Option ${index + 1}`;
    const record = entry as Record<string, unknown>;
    const label = asString(record.label) ?? `Option ${index + 1}`;
    const description = asString(record.description);
    return description ? `- ${label}: ${description}` : `- ${label}`;
  });
}

function renderBranches(value: unknown): string[] {
  if (!Array.isArray(value)) return ["- No branches specified."];
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") return `- Branch ${index + 1}`;
    const record = entry as Record<string, unknown>;
    const label = asString(record.label) ?? `Branch ${index + 1}`;
    const condition = asString(record.condition);
    return condition ? `- ${label}: ${condition}` : `- ${label}`;
  });
}

function formatMcpTool(node: WorkflowNode) {
  const server = asString(node.data.serverName) ?? "mcp";
  const tool = asString(node.data.toolName) ?? asString(node.data.name) ?? "tool";
  return `${server}.${tool}`;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJson(nested)]),
  );
}

function yamlScalar(value: string) {
  if (/^[a-zA-Z0-9._/-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
