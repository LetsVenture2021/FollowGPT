import { registerTool } from "../core/registry.js../core/registry;
import { ExecutionContext } from "../core/types.js../core/types;

/*
Backends to implement:
- Windows: generate AutoHotkey scripts per binding and run a resident AHK process; or node-win-hotkeys.
- macOS: iohook + CGEventTap; or Hammerspoon bridge; or Electron globalShortcut.
- Linux: xbindkeys or iohook; Wayland may need compositor-specific APIs.
Persist bindings and a daemon to manage lifecycle.
*/

registerTool({
  name: "create_hotkey",
  description: "Register a global hotkey that triggers a command or macro. (Backend required.)",
  mutate: true,
  capabilities: ["hotkeys.manage", "process.exec"],
  inputSchema: {
    type: "object",
    properties: {
      combo: { type: "string" },
      action: { type: "string" },
      backend: {
        type: "string",
        enum: ["autohotkey", "iohook", "electron", "hammerspoon", "xbindkeys"],
        default: "iohook",
      },
    },
    required: ["combo", "action"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { status: { type: "string" } } },
  handler: async (input, ctx: ExecutionContext) => {
    ctx.logger?.(`Hotkey request: ${input.combo} -> ${input.action} via ${input.backend}. Implement backend.`);
    return { status: "pending_backend" };
  },
});
