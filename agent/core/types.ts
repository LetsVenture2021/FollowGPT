export type Platform = "win32" | "darwin" | "linux";

export type Capability =
  | "files.read"
  | "files.write"
  | "files.delete"
  | "process.exec"
  | "hotkeys.manage"
  | "services.manage"
  | "tags.manage"
  | "macros.manage"
  | "archive.manage"
  | "search.read";

export type Policy = {
  allowPaths?: string[];
  denyPaths?: string[];
  allowedCapabilities?: Capability[];
  requireConfirmation?: boolean;
};

export type ExecutionContext = {
  cwd: string;
  platform: Platform;
  logger: (msg: string, meta?: any) => void;
  confirmer?: (msg: string, meta?: any) => Promise<boolean>;
  policy?: Policy;
  userPrompt?: string;
  runId?: string;
};

export type ToolHandler = (input: any, ctx: ExecutionContext) => Promise<any>;

export type ToolDescriptor = {
  name: string;
  description: string;
  mutate?: boolean;
  capabilities?: Capability[];
  inputSchema: object;
  outputSchema: object;
  handler: ToolHandler;
};

export type PlannedStep = { tool: string; input: any; rationale?: string };
export type Plan = { summary: string; steps: PlannedStep[] };
export type PlanResult = {
  plan: Plan;
  results: Array<{ step: PlannedStep; output?: any; error?: string }>;
};
