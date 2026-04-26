import type { StoredDecision } from "./db.js";

export type DivergenceResult = {
  divergenceTurn: number; // first turn where good and bad differ
  goodLen: number;
  badLen: number;
  commonPrefixLen: number;
};

/**
 * Find the first turn where good and bad runs diverge.
 * Two decisions are equal iff (tool_name, args_json) match exactly.
 */
export function findDivergence(
  good: StoredDecision[],
  bad: StoredDecision[],
): DivergenceResult {
  const minLen = Math.min(good.length, bad.length);
  let i = 0;
  for (; i < minLen; i++) {
    if (
      good[i].tool_name !== bad[i].tool_name ||
      good[i].args_json !== bad[i].args_json
    ) {
      break;
    }
  }
  return {
    divergenceTurn: i,
    goodLen: good.length,
    badLen: bad.length,
    commonPrefixLen: i,
  };
}

/**
 * Format a single decision for context replay (compact one-liner).
 */
export function summarizeDecision(d: StoredDecision): string {
  const argsStr = d.args_json.length > 80 ? d.args_json.slice(0, 80) + "..." : d.args_json;
  const resultStr = d.result.length > 100 ? d.result.slice(0, 100).replace(/\n/g, " ") + "..." : d.result.replace(/\n/g, " ");
  return `Turn ${d.turn}: ${d.tool_name}(${argsStr}) → ${resultStr}`;
}

/**
 * Build a system-instruction addendum that replays prior decisions.
 */
export function buildReplayContext(decisions: StoredDecision[]): string {
  const lines = decisions.map(summarizeDecision);
  return `You are continuing a debugging session. Previously these tool calls were made (in order):\n\n${lines.join("\n")}\n\nContinue the task naturally from this exact state. Do not redo earlier steps. Make ONE more decision at a time.`;
}
