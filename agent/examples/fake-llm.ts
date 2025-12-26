import { Plan } from "../core/types.js../core/types;

export const fakeLLM = {
  async complete(_prompt: string): Promise<string> {
    const plan: Plan = { summary: "Disk report", steps: [{ tool: "disk_report", input: {} }] };
    return JSON.stringify(plan);
  },
};
