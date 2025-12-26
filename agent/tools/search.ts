import { registerTool } from "../core/registry.js";
import { searchDocuments } from "../persistence/store.js";

registerTool({
  name: "search_index",
  description: "Search the indexed document corpus (SQLite FTS).",
  mutate: false,
  capabilities: ["search.read"],
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
    required: ["query"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { hits: { type: "array" } } },
  handler: async (input) => {
    const hits = await searchDocuments(input.query, input.limit);
    return { hits };
  },
});
