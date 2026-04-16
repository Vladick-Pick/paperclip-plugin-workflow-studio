import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { registerWorkflowStudioHandlers } from "./workflow/index.js";

const plugin = definePlugin({
  async setup(ctx) {
    registerWorkflowStudioHandlers(ctx);
    ctx.logger.info("Workflow Studio handlers registered");
  },

  async onHealth() {
    return { status: "ok", message: "Workflow Studio worker is running" };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
