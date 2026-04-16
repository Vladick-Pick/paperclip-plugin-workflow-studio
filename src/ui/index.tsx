import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  usePluginAction,
  usePluginData,
  type PluginPageProps,
  type PluginSidebarProps,
} from "@paperclipai/plugin-sdk/ui";
import {
  WORKFLOW_NODE_TYPES,
  type SkillArtifact,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowListResult,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowPreviewResult,
  type WorkflowUpdateResult,
} from "../workflow/types.js";

type CompanySkill = {
  id: string;
  metadata?: Record<string, unknown> | null;
};

type SkillFileDetail = {
  content: string;
};

const PAGE_ROUTE = "workflow-studio";

export function WorkflowStudioSidebarLink({ context }: PluginSidebarProps) {
  const href = workflowStudioPath(context.companyPrefix);
  const isActive = typeof window !== "undefined"
    && (window.location.pathname === href || window.location.pathname.startsWith(`${href}/`));

  return (
    <>
      <WorkflowStudioStyles />
      <a
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`ws-sidebar-link ${isActive ? "is-active" : ""}`}
      >
        <WorkflowStudioGlyph className="ws-icon ws-icon-sm" />
        <span className="ws-sidebar-link-label">Workflow Studio</span>
      </a>
    </>
  );
}

export function WorkflowStudioPage({ context }: PluginPageProps) {
  const companyId = context.companyId;

  if (!companyId) {
    return (
      <Shell>
        <Empty title="Select a company" body="Workflow Studio stores every graph in company-scoped plugin state." />
      </Shell>
    );
  }

  return <WorkflowStudio companyId={companyId} companyPrefix={context.companyPrefix} />;
}

function WorkflowStudio({ companyId, companyPrefix }: { companyId: string; companyPrefix: string | null }) {
  const { data, loading, error, refresh } = usePluginData<WorkflowListResult>("workflow.list", { companyId });
  const createWorkflow = usePluginAction("workflow.create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const workflows = data?.workflows ?? [];
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && workflows[0]) setSelectedId(workflows[0].id);
    if (selectedId && !workflows.some((workflow) => workflow.id === selectedId)) {
      setSelectedId(workflows[0]?.id ?? null);
    }
  }, [selectedId, workflows]);

  async function handleCreate() {
    const index = workflows.length + 1;
    const result = await createWorkflow({
      companyId,
      name: `Workflow ${index}`,
      slug: `workflow-${index}`,
      description: "Generated from Workflow Studio.",
    }) as { workflow: WorkflowDefinition };
    setSelectedId(result.workflow.id);
    refresh();
  }

  return (
    <Shell>
      <header className="ws-header">
        <div className="ws-header-copy">
          <a className="ws-breadcrumb" href={pluginsHomePath(companyPrefix)}>
            Plugins
          </a>
          <div className="ws-title-row">
            <WorkflowStudioGlyph className="ws-icon ws-icon-md" />
            <div className="ws-title-copy">
              <p className="ws-kicker">Company workflow editor</p>
              <h1 className="ws-title">Workflow Studio</h1>
            </div>
          </div>
          <p className="ws-subtitle">
            Build reusable workflow graphs and publish generated company skills without leaving Paperclip.
          </p>
        </div>
        <div className="ws-header-tools">
          <div className="ws-header-meta">
            <span className="ws-count-pill">{workflows.length} workflows</span>
            {selectedWorkflow ? <StatusBadge status={selectedWorkflow.publishState.status} /> : null}
          </div>
          <button className="ws-button ws-button-primary" onClick={() => void handleCreate()}>
            New workflow
          </button>
        </div>
      </header>

      {loading && <Empty title="Loading workflows" body="Reading company-scoped workflow state." />}
      {error && <Empty title="Workflow bridge error" body={error.message} tone="danger" />}

      {!loading && !error && (
        <div className="ws-frame">
          <aside className="ws-panel ws-library-panel">
            <div className="ws-panel-head">
              <div>
                <p className="ws-section-kicker">Library</p>
                <h2 className="ws-section-title">Company workflows</h2>
              </div>
            </div>
            <div className="ws-library-scroll">
              {workflows.length === 0 ? (
                <Empty title="No workflows yet" body="Create the first workflow to start shaping a reusable company skill." compact />
              ) : (
                workflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    className={`ws-workflow-item ${workflow.id === selectedId ? "is-active" : ""}`}
                    onClick={() => setSelectedId(workflow.id)}
                  >
                    <div className="ws-workflow-item-head">
                      <strong>{workflow.name}</strong>
                      <StatusBadge status={workflow.publishState.status} compact />
                    </div>
                    <span className="ws-workflow-slug">{workflow.slug}</span>
                    <span className="ws-workflow-description">
                      {workflow.description || "No description yet."}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {selectedId ? (
            <WorkflowEditor
              companyId={companyId}
              companyPrefix={companyPrefix}
              workflowId={selectedId}
              onChanged={async () => {
                refresh();
              }}
            />
          ) : (
            <main className="ws-content">
              <Empty title="Nothing selected" body="Choose a workflow from the library or create a new one." />
            </main>
          )}
        </div>
      )}
    </Shell>
  );
}

function WorkflowEditor({
  companyId,
  companyPrefix,
  workflowId,
  onChanged,
}: {
  companyId: string;
  companyPrefix: string | null;
  workflowId: string;
  onChanged: () => Promise<void>;
}) {
  const updateWorkflow = usePluginAction("workflow.update");
  const deleteWorkflow = usePluginAction("workflow.delete");
  const publishWorkflow = usePluginAction("workflow.publish");
  const { data, loading, error, refresh } = usePluginData<WorkflowPreviewResult>("workflow.preview", {
    companyId,
    workflowId,
  });
  const [draft, setDraft] = useState<WorkflowDefinition | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeJson, setNodeJson] = useState("{}");
  const [nodeJsonError, setNodeJsonError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [forceRepublish, setForceRepublish] = useState(false);

  useEffect(() => {
    if (!data?.workflow) return;
    const cloned = clone(data.workflow);
    setDraft(cloned);
    setSelectedNodeId((previous) => previous && cloned.nodes.some((node) => node.id === previous)
      ? previous
      : cloned.nodes[0]?.id ?? null);
  }, [data?.workflow.id, data?.workflow.updatedAt]);

  const selectedNode = useMemo(
    () => draft?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [draft, selectedNodeId],
  );

  useEffect(() => {
    setNodeJson(JSON.stringify(selectedNode?.data ?? {}, null, 2));
    setNodeJsonError(null);
  }, [selectedNode?.id]);

  if (loading) {
    return <main className="ws-content"><Empty title="Loading workflow" body="Preparing graph and generated skill preview." /></main>;
  }
  if (error) {
    return <main className="ws-content"><Empty title="Preview error" body={error.message} tone="danger" /></main>;
  }
  if (!draft || !data) {
    return <main className="ws-content"><Empty title="Workflow unavailable" body="Select another workflow or create a new one." /></main>;
  }

  const currentDraft = draft;
  const currentData = data;
  const currentSelectedNode = selectedNode;
  const canvasBounds = getCanvasBounds(currentDraft.nodes);

  async function saveDraft(nextDraft: WorkflowDefinition = currentDraft): Promise<WorkflowUpdateResult> {
    const result = await updateWorkflow({ companyId, workflow: nextDraft }) as WorkflowUpdateResult;
    setDraft(clone(result.workflow));
    refresh();
    await onChanged();
    return result;
  }

  async function handleDelete() {
    await deleteWorkflow({ companyId, workflowId: currentDraft.id });
    await onChanged();
  }

  function updateDraft(patch: Partial<WorkflowDefinition>) {
    setDraft({ ...currentDraft, ...patch, updatedAt: new Date().toISOString() });
  }

  function updateOverrides(key: keyof WorkflowDefinition["structuredOverrides"], value: string) {
    updateDraft({
      structuredOverrides: {
        ...currentDraft.structuredOverrides,
        [key]: value,
      },
    });
  }

  function addNode(type: WorkflowNodeType) {
    const node: WorkflowNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 72 + currentDraft.nodes.length * 48, y: 64 + currentDraft.nodes.length * 28 },
      data: defaultNodeData(type),
    };
    updateDraft({ nodes: [...currentDraft.nodes, node] });
    setSelectedNodeId(node.id);
  }

  function removeSelectedNode() {
    if (!currentSelectedNode || currentSelectedNode.type === "start" || currentSelectedNode.type === "end") return;
    const remainingNodes = currentDraft.nodes.filter((node) => node.id !== currentSelectedNode.id);
    updateDraft({
      nodes: remainingNodes,
      edges: currentDraft.edges.filter(
        (edge) => edge.source !== currentSelectedNode.id && edge.target !== currentSelectedNode.id,
      ),
    });
    setSelectedNodeId(remainingNodes[0]?.id ?? null);
  }

  function applyNodeJson() {
    if (!currentSelectedNode) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(nodeJson) as Record<string, unknown>;
      setNodeJsonError(null);
    } catch (err) {
      setNodeJsonError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }
    updateDraft({
      nodes: currentDraft.nodes.map((node) => node.id === currentSelectedNode.id ? { ...node, data: parsed } : node),
    });
  }

  function connectToEnd() {
    if (!currentSelectedNode) return;
    const end = currentDraft.nodes.find((node) => node.type === "end");
    if (!end || currentSelectedNode.id === end.id) return;
    const edge: WorkflowEdge = {
      id: `${currentSelectedNode.id}-to-${end.id}-${Date.now()}`,
      source: currentSelectedNode.id,
      target: end.id,
    };
    updateDraft({ edges: [...currentDraft.edges, edge] });
  }

  async function handlePublish() {
    setPublishError(null);
    setPublishMessage(null);
    const { workflow: savedWorkflow, artifact: latestPreview } = await saveDraft(currentDraft);
    const existingSkillId = savedWorkflow.publishState.companySkillId ?? null;
    const currentHash = existingSkillId ? await readPublishedGeneratedHash(companyId, existingSkillId) : null;
    const expectedHash = savedWorkflow.publishState.generatedHash ?? null;

    if (existingSkillId && expectedHash && currentHash && currentHash !== expectedHash && !forceRepublish) {
      await publishWorkflow({
        companyId,
        workflowId: savedWorkflow.id,
        companySkillId: existingSkillId,
        generatedHash: latestPreview.generatedHash,
        currentPublishedHash: currentHash,
      });
      setPublishError("Published CompanySkill changed outside Workflow Studio. Enable force republish to overwrite.");
      refresh();
      await onChanged();
      return;
    }

    const skill = existingSkillId
      ? await updateCompanySkill(companyId, existingSkillId, latestPreview)
      : await createCompanySkill(companyId, savedWorkflow, latestPreview);
    await writeReferenceFile(companyId, skill.id, latestPreview.referenceMarkdown);
    await publishWorkflow({
      companyId,
      workflowId: savedWorkflow.id,
      companySkillId: skill.id,
      generatedHash: latestPreview.generatedHash,
      currentPublishedHash: currentHash,
      force: forceRepublish,
    });
    setPublishMessage("Published to Company Skills.");
    setForceRepublish(false);
    refresh();
    await onChanged();
  }

  const skillLink = currentDraft.publishState.companySkillId && companyPrefix
    ? `/${companyPrefix}/skills/${currentDraft.publishState.companySkillId}`
    : null;

  return (
    <main className="ws-content">
      <section className="ws-panel ws-summary-panel">
        <div className="ws-panel-head">
          <div>
            <p className="ws-section-kicker">Definition</p>
            <h2 className="ws-section-title">{currentDraft.name}</h2>
            <p className="ws-panel-copy">Keep the graph and generated skill artifact in sync before publishing.</p>
          </div>
          <div className="ws-panel-actions">
            <button className="ws-button" onClick={() => void saveDraft()}>Save</button>
            <button className="ws-button ws-button-danger" onClick={() => void handleDelete()}>Delete</button>
          </div>
        </div>
        <div className="ws-metadata-grid">
          <label className="ws-field">
            <span>Name</span>
            <input className="ws-input" value={currentDraft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
          </label>
          <label className="ws-field">
            <span>Slug</span>
            <input className="ws-input" value={currentDraft.slug} onChange={(event) => updateDraft({ slug: event.target.value })} />
          </label>
          <label className="ws-field ws-field-wide">
            <span>Description</span>
            <input
              className="ws-input"
              value={currentDraft.description ?? ""}
              onChange={(event) => updateDraft({ description: event.target.value || null })}
            />
          </label>
        </div>
      </section>

      <div className="ws-workspace">
        <div className="ws-main-column">
          <section className="ws-panel">
            <div className="ws-panel-head">
              <div>
                <p className="ws-section-kicker">Graph</p>
                <h2 className="ws-section-title">Workflow map</h2>
              </div>
              <div className="ws-node-toolbar">
                <select className="ws-select" onChange={(event) => addNode(event.target.value as WorkflowNodeType)} value="">
                  <option value="" disabled>Add node...</option>
                  {WORKFLOW_NODE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
            </div>
            <div className="ws-canvas">
              <div className="ws-canvas-stage" style={{ width: canvasBounds.width, height: canvasBounds.height }}>
                <svg className="ws-edges" viewBox={`0 0 ${canvasBounds.width} ${canvasBounds.height}`} aria-hidden="true">
                  {currentDraft.edges.map((edge) => {
                    const source = currentDraft.nodes.find((node) => node.id === edge.source);
                    const target = currentDraft.nodes.find((node) => node.id === edge.target);
                    if (!source || !target) return null;
                    return (
                      <line
                        key={edge.id}
                        x1={source.position.x + 184}
                        y1={source.position.y + 44}
                        x2={target.position.x}
                        y2={target.position.y + 44}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 6"
                        opacity="0.5"
                      />
                    );
                  })}
                </svg>
                {currentDraft.nodes.map((node) => (
                  <button
                    key={node.id}
                    className={`ws-node-card ${node.id === selectedNodeId ? "is-active" : ""}`}
                    style={{ left: node.position.x, top: node.position.y }}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <span className="ws-node-type">{node.type}</span>
                    <strong>{stringValue(node.data.label) ?? stringValue(node.data.description) ?? node.id}</strong>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="ws-panel">
            <div className="ws-panel-head">
              <div>
                <p className="ws-section-kicker">Compiler overrides</p>
                <h2 className="ws-section-title">Structured guidance</h2>
              </div>
            </div>
            <div className="ws-form-stack">
              <label className="ws-field">
                <span>Intro</span>
                <textarea
                  className="ws-textarea"
                  value={currentDraft.structuredOverrides.introOverride ?? ""}
                  onChange={(event) => updateOverrides("introOverride", event.target.value)}
                />
              </label>
              <label className="ws-field">
                <span>Constraints</span>
                <textarea
                  className="ws-textarea"
                  value={currentDraft.structuredOverrides.constraintsOverride ?? ""}
                  onChange={(event) => updateOverrides("constraintsOverride", event.target.value)}
                />
              </label>
              <label className="ws-field">
                <span>Notes</span>
                <textarea
                  className="ws-textarea"
                  value={currentDraft.structuredOverrides.notesOverride ?? ""}
                  onChange={(event) => updateOverrides("notesOverride", event.target.value)}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="ws-side-column">
          <section className="ws-panel">
            <div className="ws-panel-head">
              <div>
                <p className="ws-section-kicker">Inspector</p>
                <h2 className="ws-section-title">{currentSelectedNode ? currentSelectedNode.type : "No node selected"}</h2>
              </div>
            </div>
            {currentSelectedNode ? (
              <>
                <p className="ws-panel-copy">
                  Editing <code>{currentSelectedNode.id}</code>
                </p>
                <textarea
                  className="ws-textarea ws-code"
                  value={nodeJson}
                  onChange={(event) => setNodeJson(event.target.value)}
                  spellCheck={false}
                />
                {nodeJsonError ? <p className="ws-message ws-message-error">{nodeJsonError}</p> : null}
                <div className="ws-inline-actions">
                  <button className="ws-button" onClick={applyNodeJson}>Apply JSON</button>
                  <button className="ws-button" onClick={connectToEnd}>Connect to End</button>
                  <button className="ws-button ws-button-danger" onClick={removeSelectedNode}>Remove</button>
                </div>
              </>
            ) : (
              <Empty title="No node selected" body="Choose a node from the graph to edit its data payload." compact />
            )}
          </section>

          <section className="ws-panel">
            <div className="ws-panel-head">
              <div>
                <p className="ws-section-kicker">Preview</p>
                <h2 className="ws-section-title">Generated skill output</h2>
              </div>
              <StatusBadge status={currentDraft.publishState.status} />
            </div>
            <pre className="ws-preview">{currentData.artifact.skillMarkdown}</pre>
            <details className="ws-details">
              <summary>references/workflow-map.md</summary>
              <pre className="ws-preview">{currentData.artifact.referenceMarkdown}</pre>
            </details>
            <label className="ws-checkbox">
              <input type="checkbox" checked={forceRepublish} onChange={(event) => setForceRepublish(event.target.checked)} />
              <span>Force republish if the CompanySkill changed outside Workflow Studio.</span>
            </label>
            <div className="ws-inline-actions">
              <button className="ws-button ws-button-primary" onClick={() => void handlePublish()}>
                Publish to Company Skills
              </button>
              {skillLink ? <a className="ws-button" href={skillLink}>Open skill</a> : null}
            </div>
            {publishMessage ? <p className="ws-message ws-message-success">{publishMessage}</p> : null}
            {publishError ? <p className="ws-message ws-message-error">{publishError}</p> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

async function createCompanySkill(companyId: string, workflow: WorkflowDefinition, artifact: SkillArtifact): Promise<CompanySkill> {
  return apiPost<CompanySkill>(`/api/companies/${encodeURIComponent(companyId)}/skills`, {
    name: workflow.name,
    slug: workflow.slug,
    description: workflow.description,
    markdown: artifact.skillMarkdown,
  });
}

async function updateCompanySkill(companyId: string, skillId: string, artifact: SkillArtifact): Promise<CompanySkill> {
  await apiPatch<SkillFileDetail>(
    `/api/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}/files`,
    { path: "SKILL.md", content: artifact.skillMarkdown },
  );
  return apiGet<CompanySkill>(`/api/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}`);
}

async function writeReferenceFile(companyId: string, skillId: string, content: string): Promise<void> {
  await apiPatch<SkillFileDetail>(
    `/api/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}/files`,
    { path: "references/workflow-map.md", content },
  );
}

async function readPublishedGeneratedHash(companyId: string, skillId: string): Promise<string | null> {
  const skill = await apiGet<CompanySkill>(`/api/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}`);
  const hash = skill.metadata?.generatedHash;
  if (typeof hash === "string") return hash;

  try {
    const file = await apiGet<SkillFileDetail>(
      `/api/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}/files?path=${encodeURIComponent("SKILL.md")}`,
    );
    return extractGeneratedHash(file.content);
  } catch {
    return null;
  }
}

function extractGeneratedHash(markdown: string): string | null {
  const match = markdown.match(/^\s{2}generatedHash:\s*["']?([a-f0-9]{64})["']?\s*$/m);
  return match?.[1] ?? null;
}

async function apiGet<T>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: "GET" });
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiRequest<T>(url, { method: "POST", body: JSON.stringify(body) });
}

async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiRequest<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}

async function apiRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

function defaultNodeData(type: WorkflowNodeType): Record<string, unknown> {
  switch (type) {
    case "prompt":
      return { label: "Prompt", prompt: "Describe the next workflow instruction." };
    case "subAgent":
      return {
        description: "Specialist agent",
        agentDefinition: "Define the agent role and capabilities.",
        prompt: "Describe the task to delegate.",
        outputPorts: 1,
      };
    case "askUserQuestion":
      return { questionText: "What should happen next?", options: [{ label: "Continue", description: "Proceed" }] };
    case "ifElse":
      return { branches: [{ label: "If", condition: "Condition is true" }, { label: "Else", condition: "Otherwise" }] };
    case "switch":
      return { branches: [{ label: "Option", condition: "When this option applies" }] };
    case "skill":
      return { skillName: "skill-name", instructions: "Use this skill when relevant." };
    case "mcp":
      return { serverName: "server", toolName: "tool", arguments: {} };
    case "subAgentFlow":
      return { flowName: "Referenced flow", instructions: "Follow the referenced sub-agent flow." };
    case "codex":
      return { prompt: "Ask Codex to perform this step.", model: "inherit" };
    case "group":
      return { label: "Group", description: "Group related workflow nodes." };
    case "start":
      return { label: "Start" };
    case "end":
      return { label: "End" };
  }
}

function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  return (
    <span className={`ws-status ${statusClassName(status)} ${compact ? "is-compact" : ""}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkflowStudioStyles />
      <div className="ws-shell">{children}</div>
    </>
  );
}

function Empty({
  title,
  body,
  tone,
  compact = false,
}: {
  title: string;
  body: string;
  tone?: "danger";
  compact?: boolean;
}) {
  return (
    <div className={`ws-empty ${tone === "danger" ? "is-danger" : ""} ${compact ? "is-compact" : ""}`}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function WorkflowStudioGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8.2 7.1 10.8 15" />
      <path d="M15.8 7.1 13.2 15" />
      <path d="M8.5 6h7" />
    </svg>
  );
}

function WorkflowStudioStyles() {
  return <style>{WORKFLOW_STUDIO_CSS}</style>;
}

function workflowStudioPath(companyPrefix: string | null): string {
  return companyPrefix ? `/${companyPrefix}/${PAGE_ROUTE}` : `/plugins/paperclip-plugin-workflow-studio`;
}

function pluginsHomePath(companyPrefix: string | null): string {
  return companyPrefix ? `/${companyPrefix}/plugins` : "/plugins";
}

function statusClassName(status: string): string {
  switch (status) {
    case "published":
      return "is-published";
    case "dirty":
      return "is-dirty";
    case "external_drift":
      return "is-drift";
    case "publish_error":
      return "is-error";
    default:
      return "is-unpublished";
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getCanvasBounds(nodes: WorkflowNode[]): CSSProperties {
  const maxX = Math.max(420, ...nodes.map((node) => node.position.x));
  const maxY = Math.max(220, ...nodes.map((node) => node.position.y));
  return {
    width: maxX + 260,
    height: maxY + 180,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const WORKFLOW_STUDIO_CSS = String.raw`
  .ws-shell {
    --ws-bg: var(--background, #090b0f);
    --ws-card: color-mix(in srgb, var(--background, #090b0f) 90%, white 4%);
    --ws-card-strong: color-mix(in srgb, var(--background, #090b0f) 84%, white 7%);
    --ws-border: var(--border, rgba(255,255,255,0.12));
    --ws-text: var(--foreground, #f4f7fb);
    --ws-muted: var(--muted-foreground, rgba(255,255,255,0.64));
    --ws-accent: #7ca2ff;
    min-height: calc(100vh - 24px);
    padding: 18px 24px 28px;
    background: var(--ws-bg);
    color: var(--ws-text);
    box-sizing: border-box;
  }

  .ws-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: end;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--ws-border);
  }

  .ws-header-copy {
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  .ws-breadcrumb {
    width: fit-content;
    color: var(--ws-muted);
    font-size: 12px;
    text-decoration: none;
    transition: color 160ms ease;
  }

  .ws-breadcrumb:hover {
    color: var(--ws-text);
  }

  .ws-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .ws-title-copy {
    min-width: 0;
  }

  .ws-kicker,
  .ws-section-kicker {
    margin: 0 0 4px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ws-muted);
  }

  .ws-title,
  .ws-section-title {
    margin: 0;
    font-size: 28px;
    line-height: 1.1;
    font-weight: 650;
    color: var(--ws-text);
  }

  .ws-section-title {
    font-size: 20px;
  }

  .ws-subtitle,
  .ws-panel-copy {
    margin: 0;
    max-width: 78ch;
    color: var(--ws-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .ws-header-tools,
  .ws-header-meta,
  .ws-panel-actions,
  .ws-inline-actions,
  .ws-node-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ws-header-tools {
    justify-content: flex-end;
  }

  .ws-count-pill,
  .ws-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--ws-border);
    border-radius: 999px;
    font-size: 12px;
    line-height: 1;
    color: var(--ws-muted);
    background: color-mix(in srgb, var(--ws-card) 86%, transparent);
    white-space: nowrap;
  }

  .ws-status.is-compact {
    min-height: 22px;
    padding: 0 8px;
    font-size: 11px;
  }

  .ws-status.is-published {
    color: #91efb1;
    border-color: color-mix(in srgb, #16a34a 58%, var(--ws-border));
    background: color-mix(in srgb, #16a34a 18%, transparent);
  }

  .ws-status.is-dirty {
    color: #fde68a;
    border-color: color-mix(in srgb, #d97706 58%, var(--ws-border));
    background: color-mix(in srgb, #d97706 18%, transparent);
  }

  .ws-status.is-drift,
  .ws-status.is-error {
    color: #fca5a5;
    border-color: color-mix(in srgb, #dc2626 58%, var(--ws-border));
    background: color-mix(in srgb, #dc2626 18%, transparent);
  }

  .ws-status.is-unpublished {
    color: var(--ws-muted);
  }

  .ws-frame {
    display: grid;
    grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
    gap: 16px;
    min-height: calc(100vh - 164px);
    padding-top: 16px;
  }

  .ws-content,
  .ws-main-column,
  .ws-side-column,
  .ws-form-stack {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .ws-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 16px;
    align-items: start;
  }

  .ws-panel {
    display: grid;
    gap: 14px;
    min-width: 0;
    border: 1px solid var(--ws-border);
    border-radius: 8px;
    background: var(--ws-card);
    padding: 16px;
    box-sizing: border-box;
  }

  .ws-library-panel {
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    padding-bottom: 0;
  }

  .ws-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
  }

  .ws-library-scroll {
    display: grid;
    gap: 10px;
    min-height: 0;
    overflow: auto;
    padding-bottom: 16px;
  }

  .ws-workflow-item,
  .ws-node-card {
    appearance: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .ws-workflow-item {
    display: grid;
    gap: 8px;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--ws-border);
    border-radius: 8px;
    background: var(--ws-card-strong);
    color: var(--ws-text);
    transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
  }

  .ws-workflow-item:hover,
  .ws-node-card:hover,
  .ws-button:hover,
  .ws-sidebar-link:hover {
    border-color: color-mix(in srgb, var(--ws-accent) 50%, var(--ws-border));
  }

  .ws-workflow-item.is-active,
  .ws-node-card.is-active {
    border-color: color-mix(in srgb, var(--ws-accent) 70%, var(--ws-border));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ws-accent) 34%, transparent);
  }

  .ws-workflow-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .ws-workflow-slug,
  .ws-workflow-description {
    font-size: 12px;
    line-height: 1.4;
    color: var(--ws-muted);
  }

  .ws-button,
  .ws-input,
  .ws-select,
  .ws-textarea {
    font: inherit;
  }

  .ws-button {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid var(--ws-border);
    background: transparent;
    color: var(--ws-text);
    text-decoration: none;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .ws-button-primary {
    border-color: var(--ws-text);
    background: var(--ws-text);
    color: var(--ws-bg);
  }

  .ws-button-primary:hover {
    background: color-mix(in srgb, var(--ws-text) 92%, transparent);
  }

  .ws-button-danger {
    color: #fca5a5;
    border-color: color-mix(in srgb, #dc2626 58%, var(--ws-border));
    background: color-mix(in srgb, #dc2626 15%, transparent);
  }

  .ws-metadata-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .ws-field {
    display: grid;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    color: var(--ws-muted);
  }

  .ws-field-wide {
    grid-column: 1 / -1;
  }

  .ws-input,
  .ws-select,
  .ws-textarea {
    width: 100%;
    border: 1px solid var(--ws-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--ws-card-strong) 86%, transparent);
    color: var(--ws-text);
    padding: 10px 12px;
    box-sizing: border-box;
    outline: none;
  }

  .ws-input:focus,
  .ws-select:focus,
  .ws-textarea:focus {
    border-color: color-mix(in srgb, var(--ws-accent) 72%, var(--ws-border));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ws-accent) 34%, transparent);
  }

  .ws-textarea {
    min-height: 108px;
    resize: vertical;
  }

  .ws-code {
    min-height: 260px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 12px;
  }

  .ws-canvas {
    overflow: auto;
    margin: 0 -16px -16px;
    padding: 0;
    border-top: 1px solid var(--ws-border);
    background-image:
      linear-gradient(to right, color-mix(in srgb, var(--ws-border) 26%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in srgb, var(--ws-border) 26%, transparent) 1px, transparent 1px);
    background-size: 24px 24px;
    height: clamp(340px, 42vh, 480px);
  }

  .ws-canvas-stage {
    position: relative;
    min-width: 100%;
    min-height: 100%;
  }

  .ws-edges {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    color: var(--ws-muted);
    pointer-events: none;
  }

  .ws-node-card {
    position: absolute;
    display: grid;
    gap: 6px;
    width: 184px;
    min-height: 88px;
    padding: 12px;
    border: 1px solid var(--ws-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--ws-card) 88%, transparent);
    color: var(--ws-text);
    box-sizing: border-box;
  }

  .ws-node-type {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ws-accent);
  }

  .ws-preview {
    margin: 0;
    padding: 12px;
    max-height: 320px;
    overflow: auto;
    border: 1px solid var(--ws-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--ws-bg) 86%, #111827 14%);
    color: #dbe6ff;
    white-space: pre-wrap;
    font-size: 12px;
    line-height: 1.55;
    box-sizing: border-box;
  }

  .ws-details {
    display: grid;
    gap: 8px;
  }

  .ws-details summary {
    cursor: pointer;
    color: var(--ws-muted);
    font-size: 12px;
  }

  .ws-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    color: var(--ws-muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .ws-checkbox input {
    margin-top: 2px;
  }

  .ws-message {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
  }

  .ws-message-success {
    color: #91efb1;
  }

  .ws-message-error {
    color: #fca5a5;
  }

  .ws-empty {
    display: grid;
    gap: 6px;
    padding: 18px;
    border: 1px dashed color-mix(in srgb, var(--ws-border) 82%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--ws-card) 80%, transparent);
    color: var(--ws-muted);
  }

  .ws-empty strong {
    color: var(--ws-text);
  }

  .ws-empty p {
    margin: 0;
    line-height: 1.5;
  }

  .ws-empty.is-danger {
    border-color: color-mix(in srgb, #dc2626 58%, var(--ws-border));
    color: #fca5a5;
  }

  .ws-empty.is-compact {
    padding: 14px;
  }

  .ws-sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--ws-text);
    text-decoration: none;
    box-sizing: border-box;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .ws-sidebar-link.is-active {
    border-color: var(--ws-border);
    background: color-mix(in srgb, var(--ws-card) 90%, transparent);
  }

  .ws-sidebar-link-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ws-icon {
    display: block;
    flex: none;
  }

  .ws-icon-sm {
    width: 16px;
    height: 16px;
  }

  .ws-icon-md {
    width: 18px;
    height: 18px;
    color: var(--ws-accent);
  }

  @media (max-width: 1360px) {
    .ws-workspace {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 980px) {
    .ws-shell {
      padding: 16px;
    }

    .ws-header,
    .ws-frame,
    .ws-metadata-grid {
      grid-template-columns: 1fr;
    }

    .ws-header-tools {
      justify-content: flex-start;
    }

    .ws-frame {
      min-height: auto;
    }
  }
`;
