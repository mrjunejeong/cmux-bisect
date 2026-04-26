/**
 * JSON-file storage. Replaces better-sqlite3 to avoid native binding pain
 * (NODE_MODULE_VERSION mismatches on every Node minor bump).
 *
 * Why JSON not SQLite:
 *   - Hackathon scope = ~hundreds of decisions across a few runs (tiny)
 *   - Zero native deps → works on any Node 20+, any Vercel runtime
 *   - Trivially inspectable (`cat cmux-bisect.json | jq`)
 *   - Atomic-ish writes (write to .tmp + rename)
 *
 * If we ever need real query power, swap to node:sqlite (Node 22+ built-in).
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import type { Decision } from "./agent.js";

export const DEFAULT_DB_PATH = "./cmux-bisect.json";

export type RunMeta = {
  run_id: string;
  user_prompt: string;
  system_instruction: string | null;
  cwd: string;
  created_at: number;
};

export type StoredDecision = {
  run_id: string;
  decision_id: number;
  turn: number;
  tool_name: string;
  args_json: string;
  result: string;
  timestamp: number;
};

type Schema = {
  runs: Record<string, RunMeta>;
  decisions: Record<string, StoredDecision[]>;
};

export class JsonDb {
  private data: Schema;
  constructor(public readonly path: string = DEFAULT_DB_PATH) {
    const abs = resolve(path);
    if (existsSync(abs)) {
      try {
        this.data = JSON.parse(readFileSync(abs, "utf-8"));
        if (!this.data.runs) this.data.runs = {};
        if (!this.data.decisions) this.data.decisions = {};
      } catch {
        this.data = { runs: {}, decisions: {} };
      }
    } else {
      this.data = { runs: {}, decisions: {} };
    }
  }

  private flush(): void {
    const abs = resolve(this.path);
    const tmp = join(dirname(abs), `.${basename(abs)}.tmp`);
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf-8");
    renameSync(tmp, abs);
  }

  saveRun(
    runId: string,
    userPrompt: string,
    cwd: string,
    decisions: Decision[],
    systemInstruction?: string,
  ): void {
    this.data.runs[runId] = {
      run_id: runId,
      user_prompt: userPrompt,
      system_instruction: systemInstruction ?? null,
      cwd,
      created_at: Date.now(),
    };
    this.data.decisions[runId] = decisions.map((d, idx) => ({
      run_id: runId,
      decision_id: idx,
      turn: d.turn,
      tool_name: d.tool_name,
      args_json: JSON.stringify(d.args),
      result: d.result,
      timestamp: d.timestamp,
    }));
    this.flush();
  }

  getRun(runId: string): RunMeta | undefined {
    return this.data.runs[runId];
  }

  getDecisions(runId: string): StoredDecision[] {
    return this.data.decisions[runId] ?? [];
  }

  listRuns(): RunMeta[] {
    return Object.values(this.data.runs);
  }

  close(): void {
    /* noop */
  }
}

// Backwards-compatible function names so callers don't need to change much.
export function openDb(path?: string): JsonDb {
  return new JsonDb(path);
}

export function saveRun(
  db: JsonDb,
  runId: string,
  userPrompt: string,
  cwd: string,
  decisions: Decision[],
  systemInstruction?: string,
): void {
  db.saveRun(runId, userPrompt, cwd, decisions, systemInstruction);
}

export function getDecisions(db: JsonDb, runId: string): StoredDecision[] {
  return db.getDecisions(runId);
}

export function getRun(db: JsonDb, runId: string): RunMeta | undefined {
  return db.getRun(runId);
}
