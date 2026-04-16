import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip-plugin-workflow-studio",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Workflow Studio",
  description: "Visual workflow editor that publishes Paperclip Company Skills",
  author: "NoHum",
  categories: ["workspace", "ui"],
  minimumPaperclipVersion: "v2026.416.0",
  capabilities: [
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
    "ui.action.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  ui: {
    slots: [
      {
        type: "page",
        id: "workflow-studio-page",
        displayName: "Workflow Studio",
        routePath: "workflow-studio",
        exportName: "WorkflowStudioPage"
      }
    ],
    launchers: [
      {
        id: "workflow-studio-launcher",
        displayName: "Workflow Studio",
        description: "Design workflows and publish them as company skills.",
        placementZone: "page",
        action: {
          type: "navigate",
          target: "workflow-studio"
        },
        render: {
          environment: "hostRoute",
          bounds: "full"
        }
      }
    ]
  }
};

export default manifest;
