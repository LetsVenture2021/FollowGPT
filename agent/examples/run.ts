import "../tools/fs";
import "../tools/macros";
import "../tools/hotkeys";
import "../tools/tags";
import "../tools/services";
import "../tools/search";

import { handleUserPrompt } from "../core/runtime.js";
import { fakeLLM } from "./fake-llm.js";
import { logRun } from "../persistence/store.js";

(async () => {
  const prompt = process.argv.slice(2).join(" ") || "generate a disk report";
  const result = await handleUserPrompt(prompt, fakeLLM, {
    logger: (m) => console.log(m),
    policy: {
      allowPaths: [process.cwd()],
      denyPaths: [],
      allowedCapabilities: [
        "files.read",
        "files.write",
        "files.delete",
        "process.exec",
        "hotkeys.manage",
        "services.manage",
        "tags.manage",
        "macros.manage",
        "archive.manage",
        "search.read",
      ],
      requireConfirmation: false,
    },
  });

  await logRun(result.plan.summary + ":" + Date.now(), prompt, result.plan, result.results);
  console.dir(result, { depth: 6 });
})();
