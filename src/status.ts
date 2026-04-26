import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_PATH = "./viewer/public/demo-status.json";

export type DecisionForViewer = {
  decision_id: number;
  turn: number;
  tool_name: string;
  args_json: string;
  result?: string;
};

export type BisectStatus = {
  phase: "starting" | "trial" | "round_done" | "done" | "error";
  good_run_id: string;
  bad_run_id: string;
  divergence_turn: number;
  total_decisions_in_bad: number;
  total_rounds_estimate: number;
  current_round: number;
  current_lo: number;
  current_hi: number;
  current_midpoint: number;
  trial_votes: ("good" | "bad" | "pending")[]; // per K
  history: { round: number; midpoint: number; passed: boolean }[];
  first_bad_decision_id?: number;
  first_bad_summary?: string;
  rounds_used?: number;
  // Decision arrays for viewer rendering (optional, set once at start)
  good_decisions?: DecisionForViewer[];
  bad_decisions?: DecisionForViewer[];
  user_prompt?: string;
  oracle_cmd?: string;
  updated_at: number;
};

export function writeStatus(status: BisectStatus, path: string = DEFAULT_PATH): void {
  status.updated_at = Date.now();
  try {
    // mkdir -p the parent so first write to viewer/public/ doesn't ENOENT silently.
    // Why: this used to fail without notice and the Vercel-hosted viewer would
    // 404 the demo-status.json file forever. Loud-fail is safer than silent-fail.
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(status, null, 2), "utf-8");
  } catch (e: any) {
    // We DO swallow but at least surface to stderr so the developer sees it.
    process.stderr.write(`[cmux-bisect] writeStatus failed: ${e?.message ?? e}\n`);
  }
}

export function readStatus(path: string = DEFAULT_PATH): BisectStatus | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}
