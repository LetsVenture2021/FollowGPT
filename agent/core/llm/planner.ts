import { listTools } from "../registry.js../registry;
import { Plan } from "../types.js../types;

type LLMClient = { complete: (prompt: string) => Promise<string> };

export async function planFromPrompt(prompt: string, client: LLMClient): Promise<Plan> {
  const tools = listTools()
    .map(
      (t) => `- ${t.name}: ${t.description} (mutate=${t.mutate}, caps=[${t.capabilities?.join(",") || ""}])`
    )
    .join("\n");

  const sys = `
You are a planner. Given a user prompt and available tools, output JSON:
{ "summary": "...", "steps": [ { "tool": "name", "input": { ... } } ] }
Use only available tools. Minimal sufficient steps. No commentary.
Tools:
${tools}
`;

  const raw = await client.complete(`${sys}\nUser: ${prompt}\nPlan:`);
  const jsonStr = repairJson(raw);
  return JSON.parse(jsonStr);
}

function repairJson(txt: string): string {
  const start = txt.indexOf("{");
  if (start >= 0) {
    const sub = txt.slice(start);
    try {
      JSON.parse(sub);
      return sub;
    } catch (e) {
      // continue
    }
  }
  const cleaned = txt.replace(/^[^{]*\{/, "{").match(/\{[\s\S]*\}/)?.[0];
  if (cleaned) return cleaned;
  throw new Error("Failed to parse plan JSON");
}
