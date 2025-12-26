import { getTool } from "./registry";
import { validate } from "./validators";
import { enforcePolicyTool } from "./policy";
import { ExecutionContext, Plan, PlanResult } from "./types";

export async function executePlan(plan: Plan, ctx: ExecutionContext): Promise<PlanResult> {
  const results: PlanResult["results"] = [];

  for (const step of plan.steps) {
    const tool = getTool(step.tool);
    if (!tool) {
      results.push({ step, error: `Unknown tool: ${step.tool}` });
      continue;
    }

    try {
      validate(tool.inputSchema, step.input);
      await enforcePolicyTool(tool, ctx);
      const output = await tool.handler(step.input, ctx);
      validate(tool.outputSchema, output);
      results.push({ step, output });
    } catch (err: any) {
      results.push({ step, error: err?.message || String(err) });
    }
  }

  return { plan, results };
}
