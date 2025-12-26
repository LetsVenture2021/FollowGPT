import { planFromPrompt } from "./llm/planner.js./llm/planner;
import { executePlan } from "../core/executor.js../core/executor;
import { ExecutionContext, PlanResult } from "./types.js./types;

type LLMClient = { complete: (prompt: string) => Promise<string> };

export async function handleUserPrompt(
  prompt: string,
  llm: LLMClient,
  ctxOverrides?: Partial<ExecutionContext>
): Promise<PlanResult> {
  const ctx: ExecutionContext = {
    cwd: ctxOverrides?.cwd || process.cwd(),
    platform: (ctxOverrides?.platform as any) || (process.platform as any),
    logger: ctxOverrides?.logger ?? console.log,
    confirmer: ctxOverrides?.confirmer,
    policy: ctxOverrides?.policy,
    userPrompt: prompt,
    runId: ctxOverrides?.runId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };

  const plan = await planFromPrompt(prompt, llm);
  ctx.logger(`PLAN: ${JSON.stringify(plan, null, 2)}`);
  return executePlan(plan, ctx);
}
