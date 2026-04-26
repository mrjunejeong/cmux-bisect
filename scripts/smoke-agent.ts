import { runAgent } from "../src/agent.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Make a tiny throwaway dir with a file
const dir = mkdtempSync(join(tmpdir(), "cmux-smoke-"));
writeFileSync(join(dir, "hello.txt"), "Hello from cmux-bisect smoke test\n");
writeFileSync(join(dir, "secret.txt"), "this should not be exposed\n");

console.log(`Test dir: ${dir}`);
console.log("Asking agent to read hello.txt and tell me what's inside...\n");

const decisions = await runAgent({
  userPrompt:
    "Read the file hello.txt in the current directory and tell me what's in it. Then list all files. Stop when done.",
  cwd: dir,
  maxTurns: 10,
  onDecision: (d) => {
    const argsPreview = JSON.stringify(d.args).slice(0, 80);
    console.log(`  [turn ${d.turn}] ${d.tool_name}(${argsPreview})`);
    console.log(`    → ${d.result.slice(0, 100).replace(/\n/g, " ")}`);
  },
});

console.log(`\n✓ Agent finished with ${decisions.length} decisions`);
