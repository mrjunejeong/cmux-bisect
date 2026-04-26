import { writeFileSync, existsSync, readFileSync } from "node:fs";

const DEFAULT_PATH = "./viewer/public/demo-status.json";

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
  updated_at: number;
};

export function writeStatus(status: BisectStatus, path: string = DEFAULT_PATH): void {
  status.updated_at = Date.now();
  try {
    writeFileSync(path, JSON.stringify(status, null, 2), "utf-8");
  } catch (e) {
    // ignore — path may not exist (e.g., when running without viewer)
  }
}

export function readStatus(path: string = DEFAULT_PATH): BisectStatus | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}
