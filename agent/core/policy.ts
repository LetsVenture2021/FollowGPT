import path from "path";
import { ExecutionContext, ToolDescriptor } from "./types.js";

const isUnder = (p: string, root: string) => {
  const P = path.resolve(p);
  const R = path.resolve(root);
  return P === R || P.startsWith(R + path.sep);
};

export function enforcePolicyPath(targets: string[], ctx: ExecutionContext) {
  const pol = ctx.policy;
  if (!pol) return;
  for (const t of targets) {
    if (pol.denyPaths?.some((dp) => isUnder(t, dp))) throw new Error(`Denied path: ${t}`);
    if (pol.allowPaths?.length && !pol.allowPaths.some((ap) => isUnder(t, ap))) {
      throw new Error(`Path not allowed: ${t}`);
    }
  }
}

export async function enforcePolicyTool(tool: ToolDescriptor, ctx: ExecutionContext) {
  const pol = ctx.policy;
  if (!pol) return;

  if (tool.capabilities?.length && pol.allowedCapabilities?.length) {
    const missing = tool.capabilities.filter((c) => !pol.allowedCapabilities!.includes(c));
    if (missing.length) throw new Error(`Capabilities not allowed: ${missing.join(",")}`);
  }

  if (tool.mutate && pol.requireConfirmation && ctx.confirmer) {
    const ok = await ctx.confirmer(`Execute mutating tool: ${tool.name}?`, { tool: tool.name });
    if (!ok) throw new Error("User rejected mutation.");
  }
}
