# cmux-bisect

> **AI 가 30분 동안 50개 결정을 한 후 결과가 깨졌을 때, 어느 결정이 첫 번째로 잘못된 결정인지 자동으로 찾아준다.**
>
> 🌐 **라이브 데모**: https://cmux-bisect.vercel.app  ·  📦 [GitHub](https://github.com/mrjunejeong/cmux-bisect)
>
> *(English version below ↓)*

---

## 이게 뭔데? — 1분 설명

### 원래 문제

요즘 개발자들이 AI 코딩 도구 (Claude Code, Cursor, ChatGPT, Copilot 등) 한테 일을 시킵니다. 예를 들어:
- *"이 버그 고쳐줘"*
- *"JWT 인증 추가해줘"*
- *"이 함수 리팩토링해줘"*

AI 는 보통 5-30분 동안 일하면서 **수십 개의 결정** 을 내립니다:

```
1. 어느 파일을 먼저 읽을까 → src/auth.py
2. 어떤 라이브러리를 쓸까 → pyjwt
3. 어떤 함수를 수정할까 → create_token
4. 테스트는 어떻게 돌릴까 → pytest
5. 깨졌네, 다시 시도해보자 → ...
... [총 50개 결정] ...
```

**문제**: AI 가 끝나고 보니 **결과가 잘못됨**. 테스트가 여전히 깨져 있거나, 코드가 엉뚱하게 짜여 있거나, 아예 AI 가 거짓말로 "다 됐어요" 라고 보고함.

당신은 묻고 싶음: **"50개 결정 중 어디서부터 잘못됐지?"**

지금까지 답하는 방법:
- ❌ AI 가 한 30분짜리 대화 로그를 처음부터 다 읽음 → **1시간 이상 걸림**
- ❌ 그냥 처음부터 다시 시킴 → **또 30분 + LLM 비용 추가**
- ❌ 다른 AI 한테 "어디 잘못됐냐" 물음 → **답변이 추측, 검증 안 됨**
- ❌ 그냥 본인이 직접 코드 작성 → **AI 쓴 의미 없음**

### cmux-bisect 가 하는 것

**Binary search (이분 탐색) 으로 잘못된 결정을 자동으로 찾아줍니다.**

비유로 설명: 1-100 사이 숫자 맞추는 게임. 아이가 "1이야? 2이야? 3이야?" 100번 물어보면 비효율. 똑똑한 사람은 "50보다 커?" 한 번에 절반 자름. 그 다음 "75보다 커?" 또 절반. **7번이면 답 나옴.**

같은 원리를 AI 결정에 적용:
1. **50개 결정 중간 (#25) 에서 다시 fork.** AI 가 거기까지의 결정을 그대로 따라가게 한 후, 거기서부터 다시 시도시킴.
2. **다시 한 결과 테스트가 통과? → 잘못된 결정은 #26~#50 사이.** 절반 좁힘.
3. **테스트가 또 실패? → 잘못된 결정은 #1~#25 사이.** 절반 좁힘.
4. **이걸 6번 반복** = 50개 중 정확한 1개 결정 찾아냄.

### 왜 이게 좋은가?

| 기존 방식 | cmux-bisect |
|---|---|
| 사람이 30분 trace 읽기 → 1시간 | 자동 6번 fork → 5분 |
| 다른 AI 한테 "어디 잘못?" 물음 → 추측 | 진짜 테스트 슈트로 검증 → 결정론적 |
| AI 가 "다 됐어요" 거짓말 → 못 catch | 실제로 코드 다시 실행 → AI 거짓말 catch |

### 어떤 상황에서 쓰면 좋은가

✅ **유용한 경우**:
- 자동 테스트 슈트가 있음 (`pytest`, `npm test`, `cargo test` 등)
- 같은 task 의 성공한 AI run + 실패한 AI run 두 개 있음
- AI 의 의견이 아닌 실제 코드 실행 기반의 **확실한 답** 원함

❌ **유용하지 않은 경우**:
- 테스트가 없음 (UX/디자인 같은 주관적 task)
- 실패한 run 만 있고 성공한 reference 없음
- 빠른 답이면 충분 (이 경우는 그냥 LLM 한테 trace 던져서 "어디 잘못?" 물으면 됨)

### 이게 어디서 영감받았나

**`git bisect`** 라는 git 의 잘 알려진 기능에서. git bisect 는 "어느 commit 이 처음으로 코드를 깼나" 를 binary search 로 찾아줌. 우리는 같은 알고리즘을 **AI 의 결정 트리** 에 적용했음.

비결정적 시스템 (실행할 때마다 결과 다름) 의 binary search 는 어려움. **Russ Cox** (Google Go 언어 리드) 가 2013년 글에서 "K번 시도 + majority vote" 라는 해결책 제시. 우리는 이 방법을 LLM (역시 비결정적) 에 처음 적용.

---

## 빠른 시작 (5분)

```bash
git clone https://github.com/mrjunejeong/cmux-bisect.git
cd cmux-bisect
npm install
export GEMINI_API_KEY=AIza...   # https://makersuite.google.com/app/apikey
```

```bash
# 1. 번들된 데모 task 를 깨끗한 git 환경으로 준비
npm run init-example
DEMO=$(pwd)/tmp-demo/sort-bug

# 2. AI agent 한 번 돌려서 "성공한 run" 캡처 (good)
npx tsx src/cli.ts capture-run --repo $DEMO --run-id GOOD \
  --prompt "src/sortlib.py 를 고쳐서 모든 unittest 통과시켜라."

# 데모 환경 리셋
git -C $DEMO checkout -- .

# 3. AI agent 한 번 더 돌려서 "실패한 run" 캡처 (bad — 일부러 잘못된 prompt)
npx tsx src/cli.ts capture-run --repo $DEMO --run-id BAD \
  --prompt "테스트가 잘못되었다. tests/test_sort.py 를 sort_unique 의 현재 동작에 맞게 수정해라. src/ 는 건드리지 마라."

git -C $DEMO checkout -- .

# 4. 두 run 사이에서 첫 번째 잘못된 결정 자동 찾기
npx tsx src/cli.ts bisect --good GOOD --bad BAD --repo $DEMO \
  --prompt "src/sortlib.py 를 고쳐서 모든 unittest 통과시켜라." \
  --oracle "python3 -m unittest discover tests/" \
  --trials 3 --max-turns 2
```

결과:
```
Round 1/3: testing midpoint #2 → PASS, PASS → bug in (3, 5]
Round 2/3: testing midpoint #4 → FAIL, FAIL → bug in [3, 4]
Round 3/3: testing midpoint #3 → PASS, PASS → bug in (4, 4]

🎯 First bad decision: #4
   write_file({"path":"tests/test_sort.py", ...})
   → AI 가 src 대신 tests 를 수정한 그 순간이 망친 시점
   Localized in 3 rounds (vs 6 trials linear)
```

라이브 시각화는 [cmux-bisect.vercel.app](https://cmux-bisect.vercel.app) 또는 로컬:

```bash
cd viewer && npm install && npm run dev   # localhost:3000
```

---

## 명령어 4개

| 명령어 | 하는 일 |
|---|---|
| `cmux-bisect capture-run --repo <p> --run-id <id> --prompt <p>` | AI agent 한 번 돌리고 모든 결정을 `cmux-bisect.json` 에 저장 |
| `cmux-bisect show-run --run-id <id>` | 저장된 run 의 결정 출력 |
| `cmux-bisect diff --good <id> --bad <id>` | 두 run 의 첫 다른 결정 (divergence) 표시 |
| `cmux-bisect bisect --good <id> --bad <id> --repo <p> --prompt <p> --oracle <cmd>` | 자동 binary search 로 첫 나쁜 결정 찾기 |

전체 옵션: `npx tsx src/cli.ts <cmd> --help`

---

## 어떻게 작동하나 (조금 더 깊게)

### Agent 자체
- **Gemini 2.5 Flash** 호출 (다른 LLM 어댑터는 v0.2 로드맵)
- 3 개 tool 만 사용: `read_file`, `write_file`, `bash`
- API key 4개 round-robin (rate limit 회피)
- 모든 결정 (tool call + 결과) 을 `cmux-bisect.json` 에 first-class schema 로 저장
- 외부 CLI (`claude`, `codex`, `gemini`) 안 wrap — 자체 agent loop ~80 LOC

### Bisect 알고리즘
1. **Divergence 탐지**: GOOD 과 BAD 의 첫 다른 결정 찾음 (보통 일찍 갈라짐)
2. **Range narrowing**: divergence 이후 BAD 의 결정들 중 binary search
3. **각 midpoint 마다**:
   - `git worktree add` 로 새 isolated 환경 생성
   - BAD 의 결정 [0..midpoint] 를 worktree 에 그대로 replay (write_file 실행 등)
   - 그 상태에서 agent 다시 spawn → 짧게 진행 (`--max-turns 2`)
   - 사용자 oracle (예: `pytest`) 실행
   - exit 0 → 그 midpoint 까진 OK / non-zero → 그 midpoint 부터 잘못됨
4. **K-trials majority vote**: agent 가 비결정적이라 같은 midpoint 를 K=3 번 시도하고 다수결

### 한계 (정직)

- **Oracle 이 좋아야 함** — 테스트 슈트가 부실하면 우리도 부실. cmux-bisect 는 진실의 source 가 아니라 사용자의 oracle 을 자동화하는 도구
- **Good run 필요** — 같은 task 의 성공한 run reference 가 없으면 비교 불가
- **Agent 비결정성** — K=3 majority vote 도 100% 보장 X
- **TDD 잘 설정한 agent** 는 매 step 자체 검증 → 우리 가치 줄어듦
- **자체 agent loop 만 지원** (v0.1) — Claude Code/Codex/Cursor session log 어댑터는 v0.2

---

## 인접 prior art (정직 인용)

- [agent-replay](https://github.com/clay-good/agent-replay) — 임의 step 에서 manual fork (자동 search 없음)
- [LangGraph time-travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel) — `update_state` + resume (수동)
- [AgentDebug](https://github.com/ulab-uiuc/AgentDebug) — passive LLM-judge over static traces (re-run 안 함)
- [CodeTracer](https://arxiv.org/html/2604.11641) — reflective replay (hierarchical traversal, bisect 아님)
- Claude Code 자체 `/fork` `/rewind` — 단발, 자동 search 없음

우리가 추가한 것 = **literal `bisect` verb + worktree-fork primitive + ground-truth oracle**.

---

## 로드맵

- [x] Self-contained Gemini agent loop (3 tools)
- [x] JSON storage (no native deps)
- [x] git worktree fork primitive
- [x] K-trials majority vote binary search
- [x] CLI 4 commands
- [x] Vercel viewer (animated playback)
- [ ] Claude Code session log adapter
- [ ] Codex / Gemini CLI session log adapter
- [ ] Sigstore-signed transcript export
- [ ] CI integration (GitHub Action)

---

## 라이선스

MIT — [LICENSE](LICENSE).

---

## English

> **When an AI agent makes 50 decisions over 30 minutes and the result is broken, find the first bad decision automatically.**

### The problem

Modern devs use AI coding assistants (Claude Code, Cursor, Copilot). You give them a task like "fix this bug". The AI works for 5-30 minutes, making dozens of decisions: which file to read, which library to use, which function to modify, etc.

When the result is wrong (tests fail, fix didn't work, AI lied about completion), you need to know: **which of those 50 decisions was the first wrong one?**

Today's options are all bad:
- Read the 30-min conversation log → takes 1+ hour
- Restart from scratch → another 30 min + cost
- Ask another AI to diagnose → guess, not verified
- Write code yourself → defeats the purpose

### What cmux-bisect does

**Binary search to find the bad decision automatically.**

Like the "guess the number" game: instead of asking "is it 1? 2? 3?", smart people ask "bigger than 50?" — halving the search space each round.

Applied to AI decisions:
1. Re-fork the agent at decision #25 (midpoint of 50). Replay decisions [0..25] to that fork, let agent continue.
2. Test passes? → Bad decision is in (25, 50].
3. Test fails? → Bad decision is in [0, 25].
4. Repeat 6 times → pinpoint the exact bad decision.

### Why it's good

| Old way | cmux-bisect |
|---|---|
| Read 30-min trace → 1 hour | 6 auto forks → 5 min |
| Ask LLM to diagnose → guess | Real test suite verifies → deterministic |
| AI claims "done" but lied → undetected | Re-runs actual code → catches the lie |

### When to use

✅ You have an automated test suite (`pytest`, `npm test`, etc.)
✅ You have a successful + failed run of the same task
✅ You want a verified answer, not an LLM's opinion

❌ No oracle / tests
❌ Only one failed run, no reference
❌ Quick "ask Claude what went wrong" is good enough

### Inspired by

`git bisect` — git's well-known tool for finding bad commits via binary search. We apply the same algorithm to AI agent decision trees.

Russ Cox (Google Go lead) extended bisect to non-deterministic systems with "K-runs majority vote" recipe. We apply his recipe to LLMs (also non-deterministic).

### Quick start

```bash
git clone https://github.com/mrjunejeong/cmux-bisect.git
cd cmux-bisect && npm install
export GEMINI_API_KEY=AIza...

npm run init-example
DEMO=$(pwd)/tmp-demo/sort-bug

npx tsx src/cli.ts capture-run --repo $DEMO --run-id GOOD --prompt "Fix src/sortlib.py so all tests pass."
git -C $DEMO checkout -- .
npx tsx src/cli.ts capture-run --repo $DEMO --run-id BAD --prompt "Tests are wrong. Edit tests to match current behavior."
git -C $DEMO checkout -- .

npx tsx src/cli.ts bisect --good GOOD --bad BAD --repo $DEMO \
  --prompt "Fix src/sortlib.py so all tests pass." \
  --oracle "python3 -m unittest discover tests/" \
  --trials 3 --max-turns 2
```

Output: `🎯 First bad decision: #4 — agent edited tests instead of source. Localized in 3 rounds.`

Live viewer: https://cmux-bisect.vercel.app

### Honest limitations

- Your test suite is the ground truth, not us. Bad oracle → bad answer.
- Need both a good run and a bad run for comparison.
- Agent non-determinism — K=3 majority vote is mitigation, not guarantee.
- Well-configured TDD agents catch their own mistakes step-by-step → diminishes our value.
- v0.1 supports our own agent loop only. Adapters for Claude Code/Codex on roadmap.

### License

MIT.
