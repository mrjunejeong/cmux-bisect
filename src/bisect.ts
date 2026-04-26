import chalk from "chalk";
import { runAgent } from "./agent.js";
import { forkWorktree, cleanupWorktree } from "./worktree.js";
import { runOracle } from "./oracle.js";
import { findDivergence, buildReplayContext } from "./tree.js";
import { writeStatus, type BisectStatus } from "./status.js";
import { tools, type ToolContext } from "./tools.js";
import type { StoredDecision } from "./db.js";

/**
 * Replay prior decisions against the worktree by re-executing each tool call.
 * This puts the worktree in the same FS state the bad run reached at that point.
 * Errors are swallowed (best-effort) — the agent will see the actual state and adapt.
 */
function replayDecisionsToWorktree(
  decisions: StoredDecision[],
  cwd: string,
): void {
  const ctx: ToolContext = { cwd };
  for (const d of decisions) {
    const fn = tools[d.tool_name];
    if (!fn) continue;
    try {
      const args = JSON.parse(d.args_json);
      fn(args, ctx);
    } catch {
      /* ignore replay errors */
    }
  }
}

export type BisectOpts = {
  good: StoredDecision[];
  bad: StoredDecision[];
  goodRunId: string;
  badRunId: string;
  repo: string;
  userPrompt: string;
  oracleCmd: string;
  K?: number;
  baseBranch?: string;
  maxAgentTurns?: number;
};

export type BisectResult = {
  firstBadDecision: StoredDecision;
  roundsUsed: number;
  history: { round: number; midpoint: number; passed: boolean }[];
};

/**
 * Binary search for first bad decision in `bad` run.
 * Returns the StoredDecision (from bad run) at the localized index.
 */
export async function bisect(opts: BisectOpts): Promise<BisectResult> {
  const {
    good,
    bad,
    goodRunId,
    badRunId,
    repo,
    userPrompt,
    oracleCmd,
    K = 3,
    baseBranch = "HEAD",
    maxAgentTurns = 20,
  } = opts;

  const div = findDivergence(good, bad);
  // Bisect range: from divergence point to end of bad run
  let lo = div.divergenceTurn;
  let hi = bad.length - 1;

  if (lo > hi) {
    throw new Error("good and bad runs do not diverge");
  }

  const totalRoundsEstimate = Math.ceil(Math.log2(hi - lo + 1)) || 1;
  const history: { round: number; midpoint: number; passed: boolean }[] = [];
  let round = 0;

  const toViewerDecision = (d: StoredDecision) => ({
    decision_id: d.decision_id,
    turn: d.turn,
    tool_name: d.tool_name,
    args_json: d.args_json,
    result: d.result.slice(0, 200),
  });

  const status: BisectStatus = {
    phase: "starting",
    good_run_id: goodRunId,
    bad_run_id: badRunId,
    divergence_turn: div.divergenceTurn,
    total_decisions_in_bad: bad.length,
    total_rounds_estimate: totalRoundsEstimate,
    current_round: 0,
    current_lo: lo,
    current_hi: hi,
    current_midpoint: -1,
    trial_votes: [],
    history,
    good_decisions: good.map(toViewerDecision),
    bad_decisions: bad.map(toViewerDecision),
    user_prompt: userPrompt,
    oracle_cmd: oracleCmd,
    updated_at: Date.now(),
  };
  writeStatus(status);

  console.log(chalk.cyan(`\n🔍 Bisecting ${bad.length} decisions (range ${lo}..${hi}, divergence at ${div.divergenceTurn})`));
  console.log(chalk.cyan(`Expected rounds: ~${totalRoundsEstimate}, K=${K} trials per midpoint\n`));

  while (lo < hi) {
    round++;
    const mid = Math.floor((lo + hi) / 2);
    status.phase = "trial";
    status.current_round = round;
    status.current_midpoint = mid;
    status.current_lo = lo;
    status.current_hi = hi;
    status.trial_votes = Array(K).fill("pending");
    writeStatus(status);

    console.log(chalk.bold(`Round ${round}/${totalRoundsEstimate}: testing midpoint #${mid} (range ${lo}..${hi})`));

    const priorDecisions = bad.slice(0, mid + 1);
    const replayCtx = buildReplayContext(priorDecisions);

    let passVotes = 0;
    let failVotes = 0;
    for (let k = 0; k < K; k++) {
      const wt = forkWorktree(repo, baseBranch);
      try {
        // Apply prior decisions to worktree so FS state matches the replay context
        replayDecisionsToWorktree(priorDecisions, wt.path);
        await runAgent({
          userPrompt,
          cwd: wt.path,
          systemInstruction: replayCtx,
          maxTurns: maxAgentTurns,
        });
        const result = runOracle(wt.path, oracleCmd);
        const verdict = result.passed ? "good" : "bad";
        status.trial_votes[k] = verdict;
        writeStatus(status);
        if (result.passed) passVotes++;
        else failVotes++;
        console.log(`  trial ${k + 1}/${K}: ${result.passed ? chalk.green("PASS") : chalk.red("FAIL")} (exit ${result.exitCode})`);
      } finally {
        cleanupWorktree(wt);
      }
      // Early stop if we already have majority
      if (passVotes > K / 2 || failVotes > K / 2) break;
    }

    const majorityPass = passVotes > K / 2;
    history.push({ round, midpoint: mid, passed: majorityPass });
    status.history = history;
    status.phase = "round_done";
    writeStatus(status);

    if (majorityPass) {
      // Bug is in upper half (after midpoint)
      console.log(chalk.gray(`  → midpoint passes; bug is in (${mid + 1}, ${hi}]\n`));
      lo = mid + 1;
    } else {
      // Bug is at or before midpoint
      console.log(chalk.gray(`  → midpoint fails; bug is in [${lo}, ${mid}]\n`));
      hi = mid;
    }
  }

  const firstBad = bad[lo];
  const summary = `Turn ${firstBad.turn}: ${firstBad.tool_name}(${firstBad.args_json.slice(0, 100)})`;

  status.phase = "done";
  status.first_bad_decision_id = lo;
  status.first_bad_summary = summary;
  status.rounds_used = round;
  writeStatus(status);

  console.log(chalk.green.bold(`\n🎯 First bad decision: #${lo}`));
  console.log(chalk.green(`   ${summary}`));
  console.log(chalk.gray(`   Rounds used: ${round}\n`));

  return { firstBadDecision: firstBad, roundsUsed: round, history };
}
