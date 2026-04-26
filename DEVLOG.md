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
| 2026-04-26 15:10 | better-sqlite3 → pure JSON storage | Native binding broke when user's other terminal had Node 22 vs build's Node 20 (NODE_MODULE_VERSION 115 vs 127). JSON works on any Node 20+ + any Vercel runtime + zero install pain. Dataset is tiny (hundreds of rows) so perf is fine. |
| 2026-04-26 15:30 | viewer/public/demo-status.json is **committed**, not gitignored | We want Vercel-hosted viewer to show a meaningful frozen demo from first load. CLI overwrites this file locally for live dev; only the latest committed version reaches production. Compromise: small JSON noise in git diffs is worth always-on demo. |
| 2026-04-26 15:32 | writeStatus now mkdir -p + stderr on failure | Used to silently swallow ENOENT; the viewer would 404 forever and we'd not notice. Loud failure > silent failure — always. |
| 2026-04-26 15:50 | Demo uses `--max-turns 2` to make bisect non-trivial | Without the cap, Gemini Flash recovers from any midpoint and every trial PASSes (bisect collapses to "last decision"). With cap=2, mid-bisect trials actually FAIL when replayed past the bad agent's commit point → meaningful 3-round localization at decision #4 (not #5). Frozen demo regenerated. |
| 2026-04-26 16:30 | Viewer: server-side rendering + animated playback + multi-agent context | Visitor saw an empty "no bisection" placeholder for the first paint, then a static result card. Boring + confusing. SSR now reads the frozen JSON at build time so the page is meaningful from the first byte. Added 4 fake agent cards on top (visual context: real devs run many agents) + AnimatedBisect hook that walks through the 3 rounds with timed transitions. Auto-loops every ~30s. |
| 2026-04-26 16:45 | Removed gradients + truncated long args | User complaint: BAD column bleeding sideways (write_file with full file contents = thousands of chars per cell) + linear gradients felt like AI vibe-coding shine. Fixed with `minmax(0, ...)` grid + `min-width: 0` + JS-side 80-char truncation; replaced gradients with flat fills. |
| 2026-04-26 17:00 | README rewritten for total beginners | Earlier README assumed reader knows git bisect / Russ Cox. Rewrote as: (1) plain-language problem (AI 30분 → 50 결정 → 깨짐), (2) binary-search analogy (1-100 number game), (3) honest when-to-use-and-not, (4) "git bisect" only as inspiration credit, not jargon. PRESENTATION.md aligned to same beginner-friendly script. |

---

## Status (live — update at end of each session)

### ✅ Done
- Project scaffold (TypeScript + tsx + @google/genai)
- Gemini API smoke test passes (3 keys round-robin)
- Agent loop produces decisions end-to-end (sort-bug demo: 3-4 decisions, fixes the bug)
- JSON storage + capture-run CLI command (no native deps)
- Divergence finding + diff CLI command
- git worktree fork primitive
- Oracle subprocess wrapper
- Bisect algorithm with K=3 majority vote, runs end-to-end
- status.json writer with mkdir -p + stderr-on-fail
- Next.js viewer (`viewer/app/page.tsx`) — timeline + bisection progress + result card, polls `/demo-status.json` every 1 s
- Frozen demo captured at `viewer/public/demo-status.json` (4.5 KB, sort-bug, rounds_used=2)
- Repo restructure: examples/ + tmp-demo/, no nested git
- README (KO/EN), LICENSE (MIT), DEVLOG, package.json metadata
- Pushed to GitHub `mrjunejeong/cmux-bisect@main` (sha 8242a76)
- Pre-commit safety check passes (no keys in tracked sources)

### ⚠️ Known issues / honest gaps
- **Bisect demo is too easy.** Gemini Flash is so capable it ignores misleading replay context and fixes the bug at every midpoint → all trials PASS, bisect localizes to the very last decision (trivial answer). Need a harder demo task. Options:
  1. Reduce `--max-turns 2` so the agent can't recover
  2. Multi-step bug where each "wrong" decision narrows the solution space irreversibly
  3. Capture a bad run that hits max-turns without fixing
- **No tests.** Only smoke scripts, no unit tests. Acceptable for hackathon.
- **No Claude Code adapter.** README claims adapters are roadmap — keep it that way for v0.1.
- **Vercel project not yet imported** (user does this in web UI; auto-deploy after).

### 🔜 Next session
1. ✋ User: import to Vercel (web UI, Root Directory = `viewer`) → get the public URL
2. Update README + DEVLOG with actual URL → second commit → triggers Vercel rebuild
3. Engineer a harder demo task so bisect produces a meaningful (non-trivial) answer (Phase E1)
4. Record 60-second demo video as wifi-failure fallback (Phase E2)
5. PRESENTATION.md — 60-s narrative + 4 Q&A defenses (Phase E5)
6. Pitch deck (5 slides) — see briefing §9 (Phase E3)

### 🌐 Vercel deploy walkthrough (사용자 행동, 1회만)

1. https://vercel.com → "Sign Up" → "Continue with GitHub" (mrjunejeong 계정 연결)
2. Dashboard → "Add New..." → "Project"
3. cmux-bisect repo "Import"
4. **Configure Project** 화면:
   - Project Name: `cmux-bisect`
   - Framework Preset: Next.js (auto-detected)
   - **Root Directory: `viewer`** ← ⚠️ 핵심 한 칸. 안 바꾸면 build fail
   - 나머지 default
5. "Deploy" → 30-60s 후 URL 확보 (e.g. `cmux-bisect-XXX.vercel.app`)
6. Vercel dashboard → Settings → Domains → 원하면 `cmux-bisect.vercel.app` 로 alias
7. URL 알려주면 README + DEVLOG 박고 두 번째 commit → push → 자동 rebuild

---

## How to use this devlog (for future-me / coop assistant)

- **Append** to "Status" section as work progresses. Don't rewrite history.
- **Add a row** to "Decision log" whenever you make a non-obvious architectural call. Always include the *why*.
- **Move items** between Done / Known issues / Next as state changes.
- **Commit messages** focus on *why* — devlog focuses on *what state*. They complement.
- If you find yourself writing a band-aid (setup script, weird workaround), add a "Known issue" entry explaining the root cause it papers over.
