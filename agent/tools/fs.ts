import fs from "fs";
import path from "path";
import crypto from "crypto";
import fg from "fast-glob";
import prettyBytes from "pretty-bytes";
import archiver from "archiver";
import unzipper from "unzipper";
import { registerTool } from "../core/registry";
import { enforcePolicyPath } from "../core/policy";
import { ExecutionContext } from "../core/types";

const posix = (p: string) => p.replace(/\\/g, "/");

registerTool({
  name: "find_pdfs",
  description: "Find all PDF files under a root (case-insensitive).",
  mutate: false,
  capabilities: ["files.read"],
  inputSchema: {
    type: "object",
    properties: {
      root: { type: "string" },
      maxDepth: { type: "integer", minimum: 1, nullable: true },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      count: { type: "integer" },
      files: { type: "array", items: { type: "string" } },
    },
    required: ["count", "files"],
  },
  handler: async (input, ctx: ExecutionContext) => {
    const root = input.root || ctx.cwd;
    enforcePolicyPath([root], ctx);
    const files = await fg(posix(path.join(root, "**/*.pdf")), {
      caseSensitiveMatch: false,
      deep: input.maxDepth ?? Infinity,
      absolute: true,
    });
    return { count: files.length, files };
  },
});

registerTool({
  name: "disk_report",
  description: "Summarize disk usage: totals, largest files, breakdown by extension.",
  mutate: false,
  capabilities: ["files.read"],
  inputSchema: {
    type: "object",
    properties: {
      root: { type: "string" },
      topN: { type: "integer", minimum: 1, maximum: 100, default: 15 },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      totalFiles: { type: "integer" },
      totalBytes: { type: "integer" },
      largest: {
        type: "array",
        items: { type: "object", properties: { file: { type: "string" }, bytes: { type: "integer" } } },
      },
      byExt: {
        type: "array",
        items: { type: "object", properties: { ext: { type: "string" }, count: { type: "integer" }, bytes: { type: "integer" } } },
      },
      human: { type: "object" },
    },
    required: ["totalFiles", "totalBytes", "largest", "byExt", "human"],
  },
  handler: async (input, ctx) => {
    const root = input.root || ctx.cwd;
    enforcePolicyPath([root], ctx);
    const files = await fg(posix(path.join(root, "**/*")), {
      onlyFiles: true,
      absolute: true,
      suppressErrors: true,
    });
    let totalBytes = 0;
    const largest: Array<{ file: string; bytes: number }> = [];
    const extMap = new Map<string, { count: number; bytes: number }>();

    for (const f of files) {
      const st = await fs.promises.stat(f);
      totalBytes += st.size;
      const ext = (path.extname(f) || "<none>").toLowerCase();
      const entry = extMap.get(ext) ?? { count: 0, bytes: 0 };
      entry.count += 1;
      entry.bytes += st.size;
      extMap.set(ext, entry);
      insertLargest(largest, { file: f, bytes: st.size }, input.topN ?? 15);
    }

    const byExt = Array.from(extMap.entries())
      .map(([ext, v]) => ({ ext, ...v }))
      .sort((a, b) => b.bytes - a.bytes);

    return {
      totalFiles: files.length,
      totalBytes,
      largest,
      byExt,
      human: {
        totalBytes: prettyBytes(totalBytes),
        largest: largest.map((x) => ({ ...x, human: prettyBytes(x.bytes) })),
        topExtensions: byExt.slice(0, 10).map((x) => ({ ...x, human: prettyBytes(x.bytes) })),
      },
    };
  },
});

registerTool({
  name: "dedupe_files",
  description: "Detect and delete duplicate files by SHA-256 hash.",
  mutate: true,
  capabilities: ["files.read", "files.delete"],
  inputSchema: {
    type: "object",
    properties: {
      root: { type: "string" },
      minBytes: { type: "integer", minimum: 1, default: 1 },
      apply: { type: "boolean", default: true },
      keep: { type: "string", enum: ["first", "newest", "smallest"], default: "first" },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      groups: {
        type: "array",
        items: { type: "object", properties: { hash: { type: "string" }, files: { type: "array", items: { type: "string" } } } },
      },
      deleted: { type: "array", items: { type: "string" } },
    },
    required: ["groups", "deleted"],
  },
  handler: async (input, ctx) => {
    const root = input.root || ctx.cwd;
    enforcePolicyPath([root], ctx);
    const files = await fg(posix(path.join(root, "**/*")), {
      onlyFiles: true,
      absolute: true,
      suppressErrors: true,
    });

    const byHash = new Map<string, string[]>();
    for (const f of files) {
      const st = await fs.promises.stat(f);
      if (st.size < (input.minBytes ?? 1)) continue;
      const h = await hashFile(f);
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h)!.push(f);
    }

    const groups = Array.from(byHash.entries())
      .map(([hash, arr]) => ({ hash, files: sortKeep(arr, input.keep ?? "first") }))
      .filter((g) => g.files.length > 1);

    const deleted: string[] = [];
    if (input.apply) {
      for (const g of groups) {
        const [, ...dupes] = g.files;
        for (const f of dupes) {
          enforcePolicyPath([f], ctx);
          await fs.promises.unlink(f);
          ctx.logger?.(`Deleted ${f}`);
          deleted.push(f);
        }
      }
    }

    return { groups, deleted };
  },
});

registerTool({
  name: "move_files",
  description: "Move matched files to a destination directory.",
  mutate: true,
  capabilities: ["files.read", "files.write", "files.delete"],
  inputSchema: {
    type: "object",
    properties: { glob: { type: "string" }, dest: { type: "string" }, cwd: { type: "string", nullable: true } },
    required: ["glob", "dest"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { moved: { type: "array", items: { type: "string" } } } },
  handler: async (input, ctx) => {
    const base = input.cwd || ctx.cwd;
    const files = await fg(input.glob, { cwd: base, absolute: true });
    enforcePolicyPath([...files, input.dest], ctx);
    await fs.promises.mkdir(input.dest, { recursive: true });
    const moved: string[] = [];
    for (const f of files) {
      const target = path.join(input.dest, path.basename(f));
      await fs.promises.rename(f, target);
      moved.push(target);
    }
    return { moved };
  },
});

registerTool({
  name: "copy_files",
  description: "Copy matched files to a destination directory.",
  mutate: true,
  capabilities: ["files.read", "files.write"],
  inputSchema: {
    type: "object",
    properties: { glob: { type: "string" }, dest: { type: "string" }, cwd: { type: "string", nullable: true } },
    required: ["glob", "dest"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { copied: { type: "array", items: { type: "string" } } } },
  handler: async (input, ctx) => {
    const base = input.cwd || ctx.cwd;
    const files = await fg(input.glob, { cwd: base, absolute: true });
    enforcePolicyPath([...files, input.dest], ctx);
    await fs.promises.mkdir(input.dest, { recursive: true });
    const copied: string[] = [];
    for (const f of files) {
      const target = path.join(input.dest, path.basename(f));
      await fs.promises.copyFile(f, target);
      copied.push(target);
    }
    return { copied };
  },
});

registerTool({
  name: "rename_pattern",
  description: "Rename files by replacing a substring or regex.",
  mutate: true,
  capabilities: ["files.write"],
  inputSchema: {
    type: "object",
    properties: {
      glob: { type: "string" },
      search: { type: "string" },
      replace: { type: "string" },
      regex: { type: "boolean", default: false },
      cwd: { type: "string", nullable: true },
    },
    required: ["glob", "search", "replace"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      renamed: {
        type: "array",
        items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } },
      },
    },
  },
  handler: async (input, ctx) => {
    const base = input.cwd || ctx.cwd;
    const files = await fg(input.glob, { cwd: base, absolute: true });
    enforcePolicyPath(files, ctx);
    const renamed: Array<{ from: string; to: string }> = [];
    for (const f of files) {
      const dir = path.dirname(f);
      const baseName = path.basename(f);
      const next = input.regex
        ? baseName.replace(new RegExp(input.search, "g"), input.replace)
        : baseName.replace(input.search, input.replace);
      if (next !== baseName) {
        const target = path.join(dir, next);
        await fs.promises.rename(f, target);
        renamed.push({ from: f, to: target });
      }
    }
    return { renamed };
  },
});

registerTool({
  name: "zip_files",
  description: "Zip matched files into an archive.",
  mutate: true,
  capabilities: ["archive.manage", "files.read", "files.write"],
  inputSchema: {
    type: "object",
    properties: { glob: { type: "string" }, cwd: { type: "string", nullable: true }, outFile: { type: "string" } },
    required: ["glob", "outFile"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { archive: { type: "string" }, count: { type: "integer" } } },
  handler: async (input, ctx) => {
    const base = input.cwd || ctx.cwd;
    const files = await fg(input.glob, { cwd: base, absolute: true });
    enforcePolicyPath([...files, input.outFile], ctx);
    await fs.promises.mkdir(path.dirname(input.outFile), { recursive: true });
    const out = fs.createWriteStream(input.outFile);
    const arc = archiver("zip", { zlib: { level: 9 } });
    const done = new Promise<void>((res, rej) => {
      out.on("close", () => res());
      arc.on("error", rej);
    });
    arc.pipe(out);
    for (const f of files) arc.file(f, { name: path.basename(f) });
    await arc.finalize();
    await done;
    return { archive: input.outFile, count: files.length };
  },
});

registerTool({
  name: "unzip_archive",
  description: "Unzip an archive into a destination directory.",
  mutate: true,
  capabilities: ["archive.manage", "files.write"],
  inputSchema: {
    type: "object",
    properties: { archive: { type: "string" }, dest: { type: "string" } },
    required: ["archive", "dest"],
    additionalProperties: false,
  },
  outputSchema: { type: "object", properties: { dest: { type: "string" } } },
  handler: async (input, ctx) => {
    enforcePolicyPath([input.archive, input.dest], ctx);
    await fs.promises.mkdir(input.dest, { recursive: true });
    await fs.createReadStream(input.archive).pipe(unzipper.Extract({ path: input.dest })).promise();
    return { dest: input.dest };
  },
});

registerTool({
  name: "grep_search",
  description: "Search text files for a pattern (regex optional).",
  mutate: false,
  capabilities: ["search.read", "files.read"],
  inputSchema: {
    type: "object",
    properties: {
      glob: { type: "string" },
      pattern: { type: "string" },
      regex: { type: "boolean", default: false },
      flags: { type: "string", default: "i" },
      cwd: { type: "string", nullable: true },
      maxMatches: { type: "integer", minimum: 1, default: 200 },
    },
    required: ["glob", "pattern"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      matches: {
        type: "array",
        items: { type: "object", properties: { file: { type: "string" }, line: { type: "integer" }, text: { type: "string" } } },
      },
    },
  },
  handler: async (input, ctx) => {
    const base = input.cwd || ctx.cwd;
    const files = await fg(input.glob, { cwd: base, absolute: true });
    enforcePolicyPath(files, ctx);
    const matches: any[] = [];
    const re = input.regex
      ? new RegExp(input.pattern, input.flags)
      : new RegExp(input.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), input.flags);

    for (const f of files) {
      const content = await fs.promises.readFile(f, "utf8").catch(() => "");
      const lines = content.split(/\r?\n/);
      lines.forEach((ln, idx) => {
        if (re.test(ln)) matches.push({ file: f, line: idx + 1, text: ln });
      });
      if (matches.length >= input.maxMatches) return { matches: matches.slice(0, input.maxMatches) };
    }

    return { matches };
  },
});

function insertLargest(arr: Array<{ file: string; bytes: number }>, item: { file: string; bytes: number }, max: number) {
  arr.push(item);
  arr.sort((a, b) => b.bytes - a.bytes);
  if (arr.length > max) arr.pop();
}

async function hashFile(file: string) {
  const h = crypto.createHash("sha256");
  const s = fs.createReadStream(file);
  return new Promise<string>((res, rej) => {
    s.on("data", (c) => h.update(c));
    s.on("end", () => res(h.digest("hex")));
    s.on("error", rej);
  });
}

function sortKeep(files: string[], keep: "first" | "newest" | "smallest") {
  if (keep === "first") return files;
  const stats = files.map((f) => ({ f, st: fs.statSync(f) }));
  if (keep === "newest") stats.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
  if (keep === "smallest") stats.sort((a, b) => a.st.size - b.st.size);
  return stats.map((s) => s.f);
}
