# cmux-bisect

> **AI 에이전트의 결정 트리에 `git bisect` 를 적용. `log₂(N)` 시도로 첫 번째 잘못된 tool call 찾기.**
>
> 🌐 **라이브 데모**: https://cmux-bisect.vercel.app *(셋업 완료 후 활성화)*  ·  📦 [GitHub](https://github.com/mrjunejeong/cmux-bisect)
>
> *(English version below ↓)*

AI coding agent (Claude Code / Codex / Gemini CLI / 직접 만든 것) 가 30분 task 를 돌려서 깨진 결과를 내놨을 때, 가장 어려운 디버깅 질문은 **"50개 결정 중 어느 것이 첫 번째로 잘못된 결정인가?"** 입니다.

`cmux-bisect` 는 이 질문에 `git bisect` 와 같은 binary search 로 답합니다. 각 midpoint 에서 fresh git worktree 를 fork → bad run 의 그 시점까지 결정을 worktree 에 replay → agent 가 그 상태에서 계속하게 둠 → 사용자의 테스트 슈트를 oracle 로 사용.

## 왜 만들었나

- **엔지니어 1시간 vs 5분** — 30분 trace 를 사람이 읽는 건 느림. `log₂(50) = 6` 자동 fork 는 빠름
- **Ground-truth oracle** — 사용자의 진짜 테스트 슈트를 사용 (LLM judge X), 결정론적 판정
- **Russ Cox 의 K-runs** — agent 는 비결정론적이라, 각 midpoint 를 K=3 번 시도 + majority vote. Russ Cox 가 비결정론 시스템의 hash-based bisect 를 위해 제안한 recipe 그대로

인접 prior art (정직 인용):
- [agent-replay](https://github.com/clay-good/agent-replay) — 임의 step 에서 manual fork (자동 search 없음)
- [LangGraph time-travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel) — `update_state` + resume (수동)
- [AgentDebug](https://github.com/ulab-uiuc/AgentDebug) — static trace 위 passive LLM-judge (re-run 안 함)
- [CodeTracer](https://arxiv.org/html/2604.11641) — reflective replay (hierarchical traversal, bisect 아님)
- Claude Code 자체 `/fork` `/rewind` — single-shot, 자동 search 없음

우리가 추가한 것 = **literal `bisect` verb + worktree-fork primitive + ground-truth oracle**.

## 설치

Node 20+, git, Gemini API key 필요.

```bash
git clone https://github.com/mrjunejeong/cmux-bisect.git
cd cmux-bisect
npm install
export GEMINI_API_KEY=AIza...   # 또는 GEMINI_API_KEY_1..N 으로 round-robin
```

## 빠른 시작 (5분)

> 단순화: 한 줄씩 복사하면 끝. 처음 부터 끝까지 ~5분.

```bash
# 0. (한 번만) 번들된 demo 를 깨끗한 git repo 로 만든다
npm run init-example
# → ./tmp-demo/sort-bug/ 생성. Python unittest 가 처음엔 FAIL (의도한 버그)

DEMO=$(pwd)/tmp-demo/sort-bug

# 1. GOOD run — agent 가 src/ 를 고쳐서 테스트 통과시킨다
npx tsx src/cli.ts capture-run --repo $DEMO --run-id GOOD \
  --prompt "src/sortlib.py 를 고쳐서 모든 unittest 통과시켜라."

git -C $DEMO checkout -- .   # 다음 run 위해 demo 깨진 상태로 복원

# 2. BAD run — 일부러 잘못된 방향으로 유도 (tests 를 수정하라고 prompt)
npx tsx src/cli.ts capture-run --repo $DEMO --run-id BAD \
  --prompt "테스트가 잘못되었다. tests/test_sort.py 를 sort_unique 의 현재 동작에 맞게 수정해라. src/ 는 건드리지 마라."

git -C $DEMO checkout -- .

# 3. bisect — 두 run 사이에서 첫 나쁜 결정을 binary search 로 찾는다
npx tsx src/cli.ts bisect --good GOOD --bad BAD --repo $DEMO \
  --prompt "src/sortlib.py 를 고쳐서 모든 unittest 통과시켜라." \
  --oracle "python3 -m unittest discover tests/" \
  --trials 3
```

bisect 는 매 round 마다 `viewer/public/demo-status.json` 을 갱신합니다. 라이브로 시각화하려면 별도 터미널에서:

```bash
cd viewer && npm install && npm run dev   # localhost:3000 에서 라이브 polling
```

또는 [Vercel 호스팅 버전](https://cmux-bisect.vercel.app) 으로 결과를 공유.

## 명령어

| 명령어 | 하는 일 |
|---|---|
| `cmux-bisect capture-run --repo <p> --run-id <id> --prompt <p>` | repo 에 agent 한 번 돌리고 결정을 `cmux-bisect.json` 에 저장 |
| `cmux-bisect show-run --run-id <id>` | 저장된 run 의 결정 출력 |
| `cmux-bisect diff --good <id> --bad <id>` | 두 run 의 divergence point 표시 |
| `cmux-bisect bisect --good <id> --bad <id> --repo <p> --prompt <p> --oracle <cmd>` | binary search 로 첫 나쁜 결정 찾기 |

전체 옵션: `npx tsx src/cli.ts <cmd> --help`

## Agent 동작 방식

`cmux-bisect` 는 자체 agent loop (~80 lines) 를 ship — `claude`, `codex`, `gemini` CLI 를 wrap 하지 않음. Agent 는 3개 tool 사용:

- `read_file(path)` — 8 KB cap
- `write_file(path, content)` — overwrite
- `bash(cmd)` — 30초 timeout

기본 모델 = `gemini-2.5-flash`. 결정 (tool call + 결과) 은 JSON 파일 (`cmux-bisect.json`) 에 first-class schema 로 저장 — 외부 CLI 의 session log 파싱 X. native dep 0.

## 아키텍처

```
your prompt ──► agent loop (Gemini Flash) ──► decisions ──► SQLite
                                                  │
                              ┌───────────────────┴─────────────────┐
                              ▼                                     ▼
                       capture-run                          bisect (binary search)
                                                                    │
                                                       fork git worktree per trial
                                                                    │
                                          replay bad[0..mid] decisions to worktree FS
                                                                    │
                                                  let agent continue from that state
                                                                    │
                                                 run user-supplied oracle (exit code)
                                                                    │
                                                  K=3 majority vote → narrow range
                                                                    │
                                                       first bad decision_id
```

## 직접 example 추가하기

`examples/` 에 디렉토리 하나 떨어뜨리고 agent 가 고쳐야 할 것 넣음. 그 다음:

```bash
npm run init-example -- <example-name>
```

각 example 은 exit 0 (good) 또는 non-zero (bad) 반환하는 oracle 필요. `examples/sort-bug/run-tests.sh` 가 reference.

## 로드맵

- [x] Self-contained Gemini agent loop (3 tools)
- [x] SQLite decision capture
- [x] Trial 당 git worktree fork
- [x] K-trials majority vote
- [x] CLI: `capture-run`, `show-run`, `diff`, `bisect`
- [ ] Vercel viewer (live status.json polling)
- [ ] Claude Code session log adapter (`~/.claude/projects/` 직접 read)
- [ ] Codex / Gemini CLI session log adapter
- [ ] Sigstore-signed transcript export

## 라이선스

MIT — [LICENSE](LICENSE).

---

## English

> **`git bisect` for AI agent decisions.** Localize the first bad tool call in `log₂(N)` trials.

When an AI coding agent (Claude Code / Codex / Gemini CLI / your own) takes a 30-minute task and produces a broken result, the hardest debugging question is: **which of the 50 decisions it made was the first wrong one?**

`cmux-bisect` answers that with a binary search over the agent's decision tree, the same way `git bisect` finds the first bad commit. Each midpoint trial forks a fresh git worktree, replays the bad run's decisions up to that point, lets the agent continue, and runs your test suite as an oracle.

### Why

- **Engineer hour vs. 5 minutes** — reading a 30-minute trace is slow; `log₂(50) = 6` automated forks is fast.
- **Ground-truth oracle** — uses your real test suite (not an LLM judge), so the verdict is deterministic.
- **Russ Cox's K-runs** — agents are flaky, so each midpoint is tried K=3 times with majority vote, per the recipe Cox proposed for hash-based bisect of non-deterministic systems.

### Quick start

```bash
git clone https://github.com/mrjunejeong/cmux-bisect.git
cd cmux-bisect
npm install
export GEMINI_API_KEY=AIza...
npm run init-example
DEMO=$(pwd)/tmp-demo/sort-bug

# capture two runs (with `git -C $DEMO checkout -- .` between to reset)
npx tsx src/cli.ts capture-run --repo $DEMO --run-id GOOD --prompt "Fix src/sortlib.py so all tests pass."
git -C $DEMO checkout -- .
npx tsx src/cli.ts capture-run --repo $DEMO --run-id BAD --prompt "Tests are wrong. Edit tests/ to match current behavior."
git -C $DEMO checkout -- .

# find the first bad decision
npx tsx src/cli.ts bisect --good GOOD --bad BAD --repo $DEMO \
  --prompt "Fix src/sortlib.py so all tests pass." \
  --oracle "python3 -m unittest discover tests/" \
  --trials 3
```

### Architecture

Self-contained Gemini agent loop (~80 lines), 3 tools (read_file/write_file/bash), SQLite-backed decision tree, git-worktree fork per trial, K=3 majority vote per midpoint. No `claude`/`codex`/`gemini` CLI wrapping — calls Gemini API directly.

### License

MIT.
