# DEVLOG

> Internal cooperation memo. PO + assistant both read this each session to know what's done, what's blocked, what's next, and *why* decisions were made.
>
> Written informally. Update at end of every working block.

---

## North Star

Win the **2026-04-26 Seoul AIM × Manaflow × AttentionX × AI Nexus 1-day hackathon** with `cmux-bisect`.

- Track: 🛠 **Developer Tooling** (Austin Wang BULLSEYE — uses cmux's worktree thesis even though we don't depend on cmux runtime)
- Grand Prize: 3M KRW · Track Prize: 1M KRW
- Submission: 18:00 KST · Final pitch: 19:30 KST · Vercel deploy URL **mandatory**

Full briefing (judges, kill list, Q&A defense, demo task selection): `~/proj/cmux-bisect-hackathon-briefing.md`.

---

## What lives where

```
cmux-bisect/                      ← this repo
├── src/                          ← TypeScript CLI core
│   ├── llm.ts                    Gemini client + 4-key rotation (lazy validation)
│   ├── tools.ts                  read_file, write_file, bash + Gemini fn declarations
│   ├── agent.ts                  Self-contained agent loop (~80 lines)
│   ├── db.ts                     SQLite schema (runs, decisions)
│   ├── tree.ts                   Divergence finding + replay context builder
│   ├── worktree.ts               git worktree add/remove wrapper
│   ├── oracle.ts                 Subprocess + exit code judgement
│   ├── status.ts                 status.json writer (for Vercel viewer)
│   ├── bisect.ts                 K-trials majority vote binary search
│   └── cli.ts                    commander entrypoint
├── examples/sort-bug/            ← Reference demo (plain files, NO nested .git)
│   ├── src/sortlib.py            Broken sort_unique
│   ├── tests/test_sort.py        unittest oracle (3 tests, all fail at start)
│   └── run-tests.sh              Convenience oracle runner
├── scripts/
│   ├── init-example.sh           Materialize examples/X → tmp-demo/X (with git init)
│   ├── smoke-gemini.ts           1-call API smoke test
│   └── smoke-agent.ts            End-to-end agent loop smoke test
├── viewer/                       ← Next.js Vercel app (not built yet)
└── tmp-demo/                     ← Runtime materialized demos (gitignored)

Secrets:
~/.config/cmux-bisect/env         ← chmod 600, sourced before any run
                                    NEVER committed (gitignore catches *.env)
```

---

## Decision log (why we did things this way)

| When | Decision | Why |
|---|---|---|
| 2026-04-26 14:20 | TypeScript over Python | Debian had no pip/uv pre-installed and curl-pipe-sh denied. Node + npm worked out of the box. Bonus: viewer (Vercel) becomes same-language monorepo. |
| 2026-04-26 14:30 | Self-contained agent loop, NO claude/gemini CLI wrap | Independent = no flaky external session-log parsing, decision schema is first-class, reproducible via `git clone + npm install`. |
| 2026-04-26 14:35 | Gemini 2.5 Flash as default model | 4-key rotation already authorized; ~10x cheaper than Claude; sub-2s response = snappy demo. |
| 2026-04-26 14:40 | SQLite via better-sqlite3, single `cmux-bisect.db` file | Zero external service. PRIMARY KEY changed from `(run_id, turn)` to `(run_id, decision_id)` after first end-to-end test failed (multiple tool calls share a turn). |
| 2026-04-26 14:50 | Replay prior decisions BOTH in system prompt AND on worktree FS | System prompt alone wasn't enough — agent saw clean worktree state and got confused. Now we re-execute write_file/bash/read_file on worktree before letting agent continue. |
| 2026-04-26 14:55 | demo as plain files in `examples/`, runtime materialization to `tmp-demo/` | Avoids nested .git in main repo. Clone-friendly: `npm run init-example` bootstraps a runnable copy with its own git history. |

---

## Status (live — update at end of each session)

### ✅ Done
- Project scaffold (TypeScript + tsx + better-sqlite3 + @google/genai)
- Gemini API smoke test passes
- Agent loop produces decisions end-to-end (sort-bug demo: 4 decisions, fixes the bug)
- SQLite schema + capture-run CLI command
- Divergence finding + diff CLI command
- git worktree fork primitive
- Oracle subprocess wrapper
- Bisect algorithm with K=3 majority vote, runs end-to-end
- status.json writer (no consumer yet)
- Repo restructure: examples/ + tmp-demo/, no nested git
- README, LICENSE (MIT), DEVLOG, package.json metadata
- Pre-commit safety check passes (no keys in tracked sources)

### ⚠️ Known issues / honest gaps
- **Bisect demo is too easy.** Gemini Flash is so capable it ignores misleading replay context and fixes the bug at every midpoint → all trials PASS, bisect localizes to the very last decision (trivial answer). Need a harder demo task where the bad decisions actually trap the agent. Options to try:
  1. Reduce `max-turns` so the agent can't recover
  2. Pick a task where the bad run modifies a different file the agent then commits to
  3. Use a multi-step bug where each "wrong" decision narrows the solution space irreversibly
- **No Vercel viewer yet.** `viewer/` is empty. Hour 5-6 of the build plan.
- **No tests.** Only smoke scripts, no unit tests. Acceptable for hackathon, document as roadmap.
- **No Claude Code adapter.** README claims adapters are roadmap — keep it that way for v0.1.

### 🔜 Next session
1. Engineer a harder demo task so bisect produces a meaningful (non-trivial) answer
2. Build viewer/ Next.js app polling status.json
3. Push to Vercel, get the public URL into README
4. Record 60-second demo video as fallback
5. Pitch deck (5 slides) — see briefing §9

---

## How to use this devlog (for future-me / coop assistant)

- **Append** to "Status" section as work progresses. Don't rewrite history.
- **Add a row** to "Decision log" whenever you make a non-obvious architectural call. Always include the *why*.
- **Move items** between Done / Known issues / Next as state changes.
- **Commit messages** focus on *why* — devlog focuses on *what state*. They complement.
- If you find yourself writing a band-aid (setup script, weird workaround), add a "Known issue" entry explaining the root cause it papers over.
