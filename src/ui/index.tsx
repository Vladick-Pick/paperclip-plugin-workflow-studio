import { useEffect, useMemo, useState } from "react";
import {
  usePluginAction,
  usePluginData,
  type PluginPageProps,
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

export function WorkflowStudioPage({ context }: PluginPageProps) {
  const companyId = context.companyId;

  if (!companyId) {
    return (
      <Shell>
        <Empty title="Select a company" body="Workflow Studio stores workflows per company." />
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

  useEffect(() => {
    if (!selectedId && workflows[0]) setSelectedId(workflows[0].id);
    if (selectedId && !workflows.some((workflow) => workflow.id === selectedId)) {
      setSelectedId(workflows[0]?.id ?? null);
    }
  }, [selectedId, workflows]);

  async function handleCreate() {
    const name = `Workflow ${workflows.length + 1}`;
    const result = await createWorkflow({
      companyId,
      name,
      slug: `workflow-${workflows.length + 1}`,
      description: "Generated from Workflow Studio.",
    }) as { workflow: WorkflowDefinition };
    setSelectedId(result.workflow.id);
    refresh();
  }

  return (
    <Shell>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Paperclip plugin</p>
          <h1 style={styles.title}>Workflow Studio</h1>
          <p style={styles.subtitle}>
            Design schema-compatible workflows and publish them as company skills.
          </p>
        </div>
        <button style={styles.primaryButton} onClick={() => void handleCreate()}>
          New workflow
        </button>
      </header>

      {loading && <Empty title="Loading workflows" body="Reading company-scoped plugin state." />}
      {error && <Empty title="Workflow bridge error" body={error.message} tone="danger" />}

      {!loading && !error && (
        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <h2 style={styles.panelTitle}>Library</h2>
            {workflows.length === 0 ? (
              <Empty title="No workflows yet" body="Create a workflow to start building a reusable skill." />
            ) : (
              workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  style={{
                    ...styles.workflowButton,
                    ...(workflow.id === selectedId ? styles.workflowButtonActive : {}),
                  }}
                  onClick={() => setSelectedId(workflow.id)}
                >
                  <strong>{workflow.name}</strong>
                  <span>{workflow.slug}</span>
                  <StatusBadge status={workflow.publishState.status} />
                </button>
              ))
            )}
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
            <main style={styles.main}>
              <Empty title="Nothing selected" body="Create or select a workflow." />
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
    setSelectedNodeId(cloned.nodes[0]?.id ?? null);
  }, [data?.workflow.id]);

  const selectedNode = useMemo(
    () => draft?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [draft, selectedNodeId],
  );

  useEffect(() => {
    setNodeJson(JSON.stringify(selectedNode?.data ?? {}, null, 2));
    setNodeJsonError(null);
  }, [selectedNode?.id]);

  if (loading) {
    return <main style={styles.main}><Empty title="Loading workflow" body="Preparing preview." /></main>;
  }
  if (error) {
    return <main style={styles.main}><Empty title="Preview error" body={error.message} tone="danger" /></main>;
  }
  if (!draft || !data) {
    return <main style={styles.main}><Empty title="Workflow unavailable" body="Select another workflow or create a new one." /></main>;
  }

  const currentDraft = draft;
  const currentData = data;
  const currentSelectedNode = selectedNode;

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
      position: { x: 80 + currentDraft.nodes.length * 60, y: 80 + currentDraft.nodes.length * 24 },
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
    <main style={styles.main}>
      <section style={styles.editorHeader}>
        <div style={styles.fieldGrid}>
          <label style={styles.label}>
            Name
            <input style={styles.input} value={currentDraft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
          </label>
          <label style={styles.label}>
            Slug
            <input style={styles.input} value={currentDraft.slug} onChange={(event) => updateDraft({ slug: event.target.value })} />
          </label>
          <label style={styles.labelWide}>
            Description
            <input
              style={styles.input}
              value={currentDraft.description ?? ""}
              onChange={(event) => updateDraft({ description: event.target.value || null })}
            />
          </label>
        </div>
        <div style={styles.actions}>
          <button style={styles.secondaryButton} onClick={() => void saveDraft()}>Save</button>
          <button style={styles.dangerButton} onClick={() => void handleDelete()}>Delete</button>
        </div>
      </section>

      <section style={styles.editorGrid}>
        <div style={styles.canvasPanel}>
          <div style={styles.nodeToolbar}>
            <span style={styles.panelTitle}>Graph</span>
            <select style={styles.select} onChange={(event) => addNode(event.target.value as WorkflowNodeType)} value="">
              <option value="" disabled>Add node...</option>
              {WORKFLOW_NODE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div style={styles.canvas}>
            <svg style={styles.edgesSvg} aria-hidden="true">
              {currentDraft.edges.map((edge) => {
                const source = currentDraft.nodes.find((node) => node.id === edge.source);
                const target = currentDraft.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                return (
                  <line
                    key={edge.id}
                    x1={source.position.x + 110}
                    y1={source.position.y + 36}
                    x2={target.position.x + 8}
                    y2={target.position.y + 36}
                    stroke="#7c8fb4"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                  />
                );
              })}
            </svg>
            {currentDraft.nodes.map((node) => (
              <button
                key={node.id}
                style={{
                  ...styles.nodeCard,
                  left: node.position.x,
                  top: node.position.y,
                  ...(node.id === selectedNodeId ? styles.nodeCardActive : {}),
                }}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <span style={styles.nodeType}>{node.type}</span>
                <strong>{node.data.label as string ?? node.data.description as string ?? node.id}</strong>
              </button>
            ))}
          </div>
        </div>

        <div style={styles.inspectorPanel}>
          <h2 style={styles.panelTitle}>Inspector</h2>
          {currentSelectedNode ? (
            <>
              <p style={styles.muted}>Selected: <code>{currentSelectedNode.id}</code></p>
              <textarea
                style={styles.codeArea}
                value={nodeJson}
                onChange={(event) => setNodeJson(event.target.value)}
                spellCheck={false}
              />
              {nodeJsonError && <p style={styles.error}>{nodeJsonError}</p>}
              <div style={styles.actions}>
                <button style={styles.secondaryButton} onClick={applyNodeJson}>Apply JSON</button>
                <button style={styles.secondaryButton} onClick={connectToEnd}>Connect to End</button>
                <button style={styles.dangerButton} onClick={removeSelectedNode}>Remove</button>
              </div>
            </>
          ) : (
            <Empty title="No node selected" body="Select a graph node to edit its data." />
          )}
        </div>
      </section>

      <section style={styles.editorGrid}>
        <div style={styles.inspectorPanel}>
          <h2 style={styles.panelTitle}>Structured overrides</h2>
          <label style={styles.label}>
            Intro
            <textarea
              style={styles.textArea}
              value={currentDraft.structuredOverrides.introOverride ?? ""}
              onChange={(event) => updateOverrides("introOverride", event.target.value)}
            />
          </label>
          <label style={styles.label}>
            Constraints
            <textarea
              style={styles.textArea}
              value={currentDraft.structuredOverrides.constraintsOverride ?? ""}
              onChange={(event) => updateOverrides("constraintsOverride", event.target.value)}
            />
          </label>
          <label style={styles.label}>
            Notes
            <textarea
              style={styles.textArea}
              value={currentDraft.structuredOverrides.notesOverride ?? ""}
              onChange={(event) => updateOverrides("notesOverride", event.target.value)}
            />
          </label>
        </div>

        <div style={styles.previewPanel}>
          <div style={styles.previewHeader}>
            <h2 style={styles.panelTitle}>Preview and publish</h2>
            <StatusBadge status={currentDraft.publishState.status} />
          </div>
          <pre style={styles.preview}>{currentData.artifact.skillMarkdown}</pre>
          <details>
            <summary>references/workflow-map.md</summary>
            <pre style={styles.preview}>{currentData.artifact.referenceMarkdown}</pre>
          </details>
          <label style={styles.checkboxLabel}>
            <input type="checkbox" checked={forceRepublish} onChange={(event) => setForceRepublish(event.target.checked)} />
            Force republish if the CompanySkill changed outside Workflow Studio
          </label>
          <div style={styles.actions}>
            <button style={styles.primaryButton} onClick={() => void handlePublish()}>Publish to Company Skills</button>
            {skillLink && <a style={styles.linkButton} href={skillLink}>Open skill</a>}
          </div>
          {publishMessage && <p style={styles.success}>{publishMessage}</p>}
          {publishError && <p style={styles.error}>{publishError}</p>}
        </div>
      </section>
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

function StatusBadge({ status }: { status: string }) {
  return <span style={styles.statusBadge}>{status}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={styles.shell}>{children}</div>;
}

function Empty({ title, body, tone }: { title: string; body: string; tone?: "danger" }) {
  return (
    <div style={{ ...styles.empty, ...(tone === "danger" ? styles.emptyDanger : {}) }}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100%",
    padding: 24,
    color: "#172033",
    background: "linear-gradient(135deg, #f6f2e8 0%, #eef4ff 52%, #f8fbff 100%)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  eyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: 1.8, color: "#59708f", fontSize: 12 },
  title: { margin: 0, fontSize: 34, letterSpacing: -1.2 },
  subtitle: { margin: "6px 0 0", color: "#52647d" },
  layout: { display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 18 },
  sidebar: panelStyle(),
  main: { display: "grid", gap: 18 },
  panelTitle: { margin: 0, fontSize: 16, fontWeight: 800 },
  workflowButton: {
    width: "100%",
    border: "1px solid #d7e0ee",
    borderRadius: 16,
    background: "rgba(255,255,255,0.72)",
    display: "grid",
    gap: 6,
    padding: 14,
    textAlign: "left",
    color: "#172033",
    marginTop: 10,
    cursor: "pointer",
  },
  workflowButtonActive: { borderColor: "#2f6df6", boxShadow: "0 0 0 3px rgba(47,109,246,0.12)" },
  statusBadge: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: 999,
    padding: "3px 8px",
    background: "#172033",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
  },
  editorHeader: { ...panelStyle(), display: "flex", justifyContent: "space-between", gap: 16 },
  fieldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 },
  label: { display: "grid", gap: 6, fontSize: 12, color: "#52647d", fontWeight: 700 },
  labelWide: { display: "grid", gap: 6, fontSize: 12, color: "#52647d", fontWeight: 700, gridColumn: "1 / -1" },
  input: inputStyle(),
  select: inputStyle(),
  textArea: { ...inputStyle(), minHeight: 88, resize: "vertical" },
  codeArea: {
    ...inputStyle(),
    minHeight: 260,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    resize: "vertical",
  },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  primaryButton: buttonStyle("#2f6df6", "#fff"),
  secondaryButton: buttonStyle("#edf3ff", "#172033"),
  dangerButton: buttonStyle("#ffecec", "#9b1c1c"),
  linkButton: { ...buttonStyle("#172033", "#fff"), textDecoration: "none" },
  editorGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)", gap: 18 },
  canvasPanel: panelStyle(),
  inspectorPanel: panelStyle(),
  previewPanel: panelStyle(),
  nodeToolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  canvas: {
    position: "relative",
    minHeight: 430,
    overflow: "auto",
    borderRadius: 18,
    border: "1px solid #d7e0ee",
    background: "radial-gradient(circle at 1px 1px, #d7e0ee 1px, transparent 0)",
    backgroundSize: "22px 22px",
  },
  edgesSvg: { position: "absolute", inset: 0, width: 2200, height: 1000, pointerEvents: "none" },
  nodeCard: {
    position: "absolute",
    width: 180,
    minHeight: 76,
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    border: "1px solid #cbd7e9",
    background: "rgba(255,255,255,0.9)",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 10px 25px rgba(23,32,51,0.08)",
  },
  nodeCardActive: { borderColor: "#2f6df6", boxShadow: "0 0 0 4px rgba(47,109,246,0.14)" },
  nodeType: { color: "#2f6df6", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  muted: { color: "#52647d" },
  previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  preview: {
    whiteSpace: "pre-wrap",
    maxHeight: 360,
    overflow: "auto",
    background: "#101828",
    color: "#e8eef8",
    borderRadius: 14,
    padding: 14,
    fontSize: 12,
  },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, margin: "12px 0", color: "#52647d", fontSize: 13 },
  empty: { border: "1px dashed #cbd7e9", borderRadius: 16, padding: 16, color: "#52647d" },
  emptyDanger: { borderColor: "#f4b7b7", color: "#9b1c1c", background: "#fff4f4" },
  success: { color: "#146c43", fontWeight: 700 },
  error: { color: "#9b1c1c", fontWeight: 700 },
};

function panelStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(149,164,190,0.35)",
    borderRadius: 22,
    background: "rgba(255,255,255,0.74)",
    boxShadow: "0 18px 55px rgba(23,32,51,0.10)",
    padding: 16,
    backdropFilter: "blur(12px)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    border: "1px solid #cbd7e9",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.86)",
    color: "#172033",
  };
}

function buttonStyle(background: string, color: string): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    background,
    color,
    fontWeight: 800,
    cursor: "pointer",
  };
}
