#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { runAgent } from "./agent.js";
import { openDb, saveRun, getDecisions, getRun } from "./db.js";
import { findDivergence } from "./tree.js";
import { bisect } from "./bisect.js";

const program = new Command();

program
  .name("cmux-bisect")
  .description("git bisect for AI agent decisions")
  .version("0.1.0");

program
  .command("capture-run")
  .description("Run an agent and capture its decisions to the DB")
  .requiredOption("--prompt <p>", "user prompt for the agent")
  .requiredOption("--repo <path>", "working directory (will be cwd for tools)")
  .requiredOption("--run-id <id>", "label for this run (e.g. 'A' or 'good-1')")
  .option("--system <s>", "extra system instruction")
  .option("--max-turns <n>", "max agent turns", "30")
  .option("--db <path>", "json db file", "./cmux-bisect.json")
  .action(async (opts) => {
    const cwd = resolve(opts.repo);
    console.log(chalk.cyan(`▸ capturing run ${chalk.bold(opts.runId)} in ${cwd}`));
    const decisions = await runAgent({
      userPrompt: opts.prompt,
      cwd,
      systemInstruction: opts.system,
      maxTurns: parseInt(opts.maxTurns, 10),
      onDecision: (d) => {
        console.log(chalk.gray(`  [${d.turn}] ${chalk.yellow(d.tool_name)}(${JSON.stringify(d.args).slice(0, 60)})`));
      },
    });
    const db = openDb(opts.db);
    saveRun(db, opts.runId, opts.prompt, cwd, decisions, opts.system);
    db.close();
    console.log(chalk.green(`✓ captured ${decisions.length} decisions for run ${opts.runId}`));
  });

program
  .command("show-run")
  .description("Print all decisions for a captured run")
  .requiredOption("--run-id <id>")
  .option("--db <path>", "json db file", "./cmux-bisect.json")
  .action((opts) => {
    const db = openDb(opts.db);
    const run = getRun(db, opts.runId);
    if (!run) {
      console.error(chalk.red(`run ${opts.runId} not found`));
      process.exit(1);
    }
    console.log(chalk.cyan(`Run ${run.run_id}`));
    console.log(`  prompt: ${run.user_prompt}`);
    console.log(`  cwd:    ${run.cwd}`);
    const decisions = getDecisions(db, opts.runId);
    for (const d of decisions) {
      console.log(`  [${d.turn}] ${chalk.yellow(d.tool_name)}(${d.args_json.slice(0, 80)})`);
    }
    db.close();
  });

program
  .command("diff")
  .description("Show divergence point between two captured runs")
  .requiredOption("--good <id>")
  .requiredOption("--bad <id>")
  .option("--db <path>", "json db file", "./cmux-bisect.json")
  .action((opts) => {
    const db = openDb(opts.db);
    const good = getDecisions(db, opts.good);
    const bad = getDecisions(db, opts.bad);
    if (good.length === 0 || bad.length === 0) {
      console.error(chalk.red(`one of the runs has no decisions`));
      process.exit(1);
    }
    const div = findDivergence(good, bad);
    console.log(chalk.cyan(`Divergence at turn ${div.divergenceTurn}`));
    console.log(`  good has ${div.goodLen} decisions, bad has ${div.badLen}`);
    console.log(`  common prefix: ${div.commonPrefixLen} decisions`);
    if (div.divergenceTurn < Math.min(good.length, bad.length)) {
      console.log(chalk.green(`  good[${div.divergenceTurn}]: ${good[div.divergenceTurn].tool_name}(${good[div.divergenceTurn].args_json.slice(0, 80)})`));
      console.log(chalk.red(`  bad[${div.divergenceTurn}]:  ${bad[div.divergenceTurn].tool_name}(${bad[div.divergenceTurn].args_json.slice(0, 80)})`));
    }
    db.close();
  });

program
  .command("bisect")
  .description("Binary search for first bad decision")
  .requiredOption("--good <id>")
  .requiredOption("--bad <id>")
  .requiredOption("--repo <path>")
  .requiredOption("--prompt <p>", "user prompt to re-run agent with")
  .requiredOption("--oracle <cmd>", "shell command; exit 0 = good, else = bad")
  .option("-k, --trials <n>", "trials per midpoint (majority vote)", "3")
  .option("--base <ref>", "base git ref to fork worktrees from", "HEAD")
  .option("--db <path>", "json db file", "./cmux-bisect.json")
  .option("--max-turns <n>", "max agent turns per trial", "20")
  .action(async (opts) => {
    const db = openDb(opts.db);
    const good = getDecisions(db, opts.good);
    const bad = getDecisions(db, opts.bad);
    if (good.length === 0 || bad.length === 0) {
      console.error(chalk.red(`one of the runs has no decisions`));
      process.exit(1);
    }
    const result = await bisect({
      good,
      bad,
      goodRunId: opts.good,
      badRunId: opts.bad,
      repo: resolve(opts.repo),
      userPrompt: opts.prompt,
      oracleCmd: opts.oracle,
      K: parseInt(opts.trials, 10),
      baseBranch: opts.base,
      maxAgentTurns: parseInt(opts.maxTurns, 10),
    });
    db.close();
    console.log(chalk.bold.green(`\nDone in ${result.roundsUsed} rounds.`));
  });

program.parseAsync(process.argv);
