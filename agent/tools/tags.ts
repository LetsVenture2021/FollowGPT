import { registerTool } from "../core/registry.js../core/registry;
import { enforcePolicyPath } from "../core/policy.js../core/policy;
import { ExecutionContext } from "../core/types.js../core/types;

/*
Implement:
- macOS/Linux: node-xattr, key com.followmegpt.tags storing JSON.
- Windows: NTFS ADS stream "followmegpt_tags".
Index tags in SQLite for search.
*/

registerTool({
  name: "tag_file",
  description: "Apply a tag to a file (requires xattr/ADS backend).",
  mutate: true,
  capabilities: ["tags.manage", "files.write"],
  inputSchema: { type: "object", properties: { file: { type: "string" }, tag: { type: "string" } }, required: ["file", "tag"], additionalProperties: false },
  outputSchema: { type: "object", properties: { status: { type: "string" } } },
  handler: async (input, ctx: ExecutionContext) => {
    enforcePolicyPath([input.file], ctx);
    ctx.logger?.(`Tag request: file=${input.file} tag=${input.tag}. Implement backend.`);
    return { status: "pending_backend" };
  },
});
