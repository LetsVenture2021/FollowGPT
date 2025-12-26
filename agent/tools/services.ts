import { registerTool } from "../core/registry";
import { ExecutionContext } from "../core/types";

/*
Implement:
- Windows: node-windows or NSSM wrapper; set recovery + stdout/err logs.
- macOS: write launchd plist to ~/Library/LaunchAgents, launchctl load -w.
- Linux: systemd user unit at ~/.config/systemd/user, systemctl --user enable --now.
*/

registerTool({
  name: "create_service",
  description: "Create a background service for a command.",
  mutate: true,
  capabilities: ["services.manage", "process.exec"],
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      command: { type: "string" },
      args: { type: "array", items: { type: "string" }, default: [] },
      runAtStartup: { type: "boolean", default: true },
      cwd: { type: "string", nullable: true },
      env: { type: "object", additionalProperties: { type: "string" }, nullable: true },
    },
    required: ["name", "command"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { status: { type: "string" } } },
  handler: async (input, ctx: ExecutionContext) => {
    ctx.logger?.(
      `Service request: ${input.name} -> ${input.command} ${input.args?.join(" ") || ""}. Implement OS backend.`
    );
    return { status: "pending_backend" };
  },
});
