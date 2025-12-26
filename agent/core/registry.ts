import { ToolDescriptor } from "./types.js";

const registry = new Map<string, ToolDescriptor>();

export function registerTool(tool: ToolDescriptor) {
  registry.set(tool.name, tool);
}

export function getTool(name: string) {
  return registry.get(name);
}

export function listTools() {
  return Array.from(registry.values()).map(
    ({ name, description, mutate, capabilities, inputSchema, outputSchema }) => ({
      name,
      description,
      mutate: !!mutate,
      capabilities: capabilities ?? [],
      inputSchema,
      outputSchema,
    })
  );
}
