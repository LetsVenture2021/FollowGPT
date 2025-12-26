import { registerTool } from "../core/registry.js../core/registry;
import { enforcePolicyPath, enforcePolicyTool } from "../core/policy.js../core/policy;
import { Capability, ExecutionContext } from "../core/types.js../core/types;
import { saveMacro, loadMacros } from "../persistence/store.js../persistence/store;
import { getTool } from "../core/registry.js../core/registry;
import { validate } from "../core/validators.js../core/validators;

type MacroStep =
  | { kind: "tool"; tool: string; input: any }
  | { kind: "shell"; command: string; cwd?: string };

registerTool({
  name: "create_macro",
  description: "Create a named macro with ordered steps (tool or shell).",
  mutate: true,
  capabilities: ["macros.manage"],
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          anyOf: [
            {
              properties: { kind: { const: "tool" }, tool: { type: "string" }, input: { type: "object" } },
              required: ["kind", "tool", "input"],
            },
            {
              properties: { kind: { const: "shell" }, command: { type: "string" }, cwd: { type: "string", nullable: true } },
              required: ["kind", "command"],
            },
          ],
        },
        minItems: 1,
      },
    },
    required: ["name", "steps"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { status: { type: "string" } } },
  handler: async (input, ctx: ExecutionContext) => {
    await saveMacro(input.name, input.steps);
    ctx.logger?.(`Macro '${input.name}' saved (${input.steps.length} steps).`);
    return { status: "ok" };
  },
});

registerTool({
  name: "list_macros",
  description: "List stored macros.",
  mutate: false,
  capabilities: ["macros.manage"],
  inputSchema: { type: "object", additionalProperties: false },
  outputSchema: { type: "object", properties: { macros: { type: "array" } } },
  handler: async () => {
    const macros = await loadMacros();
    return { macros };
  },
});

registerTool({
  name: "run_macro",
  description: "Run a stored macro (tool steps and shell commands).",
  mutate: true,
  capabilities: [
    "macros.manage",
    "process.exec",
    "files.read",
    "files.write",
    "files.delete",
  ] as Capability[],
  inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
  outputSchema: { type: "object", properties: { results: { type: "array" } } },
  handler: async (input, ctx: ExecutionContext) => {
    const macros = await loadMacros();
    const macro = macros.find((m) => m.name === input.name);
    if (!macro) throw new Error("Macro not found");
    const results: any[] = [];

    for (const step of macro.steps as MacroStep[]) {
      if (step.kind === "tool") {
        const tool = getTool(step.tool);
        if (!tool) throw new Error(`Unknown tool in macro: ${step.tool}`);
        validate(tool.inputSchema, step.input);
        await enforcePolicyTool(tool, ctx);
        const out = await tool.handler(step.input, ctx);
        validate(tool.outputSchema, out);
        results.push({ step, output: out });
      } else if (step.kind === "shell") {
        const cwd = step.cwd || ctx.cwd;
        enforcePolicyPath([cwd], ctx);
        const { exec } = await import("child_process");
        const shellOut = await new Promise((resolve, reject) => {
          exec(step.command, { cwd }, (err, stdout, stderr) => {
            if (err) reject(err);
            else resolve({ stdout, stderr });
          });
        });
        results.push({ step, output: shellOut });
      }
    }

    return { results };
  },
});
