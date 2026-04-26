# PRESENTATION

> 무대 위 발표용. 본인 + 팀 누구든 이 파일만 읽으면 60초 pitch + 4개 핵심 Q&A 답변 가능. 한국어 우선 + English fallback.

---

## 60초 무대 narrative (한국어, 외움)

```
[0-10s] 페인
"AI 에이전트가 30분 task 돌려서 결과가 깨졌습니다. 그 동안 50개의 결정을
내렸어요. 어느 결정이 첫 번째로 잘못된 결정인가요?
지금은 30분짜리 trace 를 사람이 1시간 들여 읽거나, 처음부터 다시 돌립니다."

[10-20s] 멘탈 모델
"git bisect 다 아시죠? 500개 commit 중 어느 게 깼는지 9번에 찾는 binary search.
저희는 같은 알고리즘을 AI 에이전트의 결정 트리에 적용했습니다."

[20-40s] 라이브 데모
$ cmux-bisect bisect --good GOOD --bad BAD \
    --oracle "pytest" --trials 3 --max-turns 2

[화면에 6 라운드 진행, 각 라운드 K=3 trial]
[majority vote 시각화: ✓ ✓ → PASS, ✗ ✗ → FAIL]
[범위 좁혀지는 애니메이션]

"3 라운드 후 결정 #4 — 에이전트가 src 대신 tests 를 수정하려 한 순간."

[40-50s] 우리만의 무기 (Russ Cox)
"비결정적인 에이전트에 binary search 가 작동할까?
Russ Cox 가 Go 컴파일러용 hash-bisect 에서 정확히 같은 문제를 인정하고
K-runs aggregation 을 제시했습니다. 우리는 그의 recipe 를
LLM 결정 트리에 처음 적용. cmux worktree primitive 가
trial 당 cost 를 $0.10 으로 만든 게 우리의 실질적 기여."

[50-60s] 마무리
"엔지니어 1시간 → 5분, 60배.
github.com/mrjunejeong/cmux-bisect
cmux-bisect.vercel.app
지금 clone 가능합니다."
```

---

## 4 Q&A 미리 답 외움

### Q1: "이거 그냥 reverse delta-debugging 아닌가요?" *(Juhyun Song / KAIST 류 sec 사람)*

**답**: "Delta-debugging 은 input minimization. 우리는 stochastic re-execution 의 single decision 을 localize. 진짜 차이는 **cmux worktree primitive 가 round 당 $0.10 으로 만든 게 신규**. Engineer 시간 대비 60배 cheaper."

### Q2: "Agent 가 비결정적인데 binary search 가 어떻게 작동하나요?" *(가장 흔한 질문)*

**답**: "**Russ Cox 본인이 'flaky tests are bisect's open problem' 이라고 명시했고 K-runs aggregation 을 추천했습니다.** 우리는 그의 framework 를 LLM 결정 트리에 처음 적용. K=3 majority vote, K log₂(N) 라운드 = 18 trial ≈ $3. 실험 데모에서 3 라운드만에 첫 나쁜 결정 #4 를 정확히 localize 했습니다."

### Q3: "AgentDebug, CodeTracer 같은 기존 연구와 어떻게 다른가요?" *(Dasol Choi / 학술 사람)*

**답**: "AgentDebug 는 static trace 위 passive LLM-judge — re-run 안 해서 counterfactual 검증 불가. CodeTracer 는 re-run 하지만 hierarchical traversal + 자기 trace format 요구. **cmux-bisect 의 moat = worktree-fork primitive 로 ground-truth oracle (test suite) 위에서 bisect — judge hallucination 없음**. 알고리즘은 단순 binary search 지만 그게 강점입니다."

### Q4: "Claude Code 에 이미 /fork /rewind 가 있는데 왜 새로 만드나요?" *(Austin Wang 풍)*

**답**: "/fork /rewind 는 single-shot, 사람이 50번 클릭해야 합니다. cmux-bisect 는 자동 binary-search loop, 6번 자동 = 10배 빠름. 그리고 cmux 가 worktree primitive 갖춰서 가능했습니다 — 당신 PR #3046, #3151 이 이걸 가능하게 만들었어요."

---

## 60-second English version (fallback)

```
[0-10s] PAIN
"An AI coding agent runs for 30 minutes and produces a broken result.
It made 50 decisions. Which one was the first wrong one?
Today: read the trace for an hour, or restart and pray."

[10-20s] MENTAL MODEL
"You all know git bisect. 500 commits, 9 yes/no questions, binary
search to the bad commit. We applied the same algorithm to an
AI agent's decision tree."

[20-40s] LIVE DEMO
$ cmux-bisect bisect --good GOOD --bad BAD \
    --oracle "pytest" --trials 3 --max-turns 2

[6 rounds visible, K=3 majority vote per midpoint]
[Trial votes light up green/red]
[Range narrows]

"3 rounds in, decision #4 — that's where the agent committed to
modifying tests instead of source."

[40-50s] WHY US (Russ Cox card)
"Agents are flaky. Does binary search even work?
Russ Cox identified flakiness as the open problem of bisect in his
hash-based bisect work for Go, and proposed K-runs aggregation.
We're the first to apply his recipe to LLM decision trees.
cmux's worktree primitive makes each trial cost $0.10."

[50-60s] CLOSE
"Engineer hour to 5 minutes. 60x.
github.com/mrjunejeong/cmux-bisect
cmux-bisect.vercel.app
Clone it now."
```

---

## 무대 셋업 체크리스트

**노트북 화면 split**:
- 왼쪽: 터미널 (cmux-bisect bisect 라이브 실행)
- 오른쪽: Chrome → `cmux-bisect.vercel.app`

**미리 열어둘 탭**:
1. `cmux-bisect.vercel.app` (frozen demo 가 깔린 결과 화면)
2. `github.com/mrjunejeong/cmux-bisect` (Q&A 시 코드 보여줄 때)
3. `research.swtch.com/bisect` (Russ Cox 인용 backup)

**터미널에 미리 cd 한 상태**:
```bash
cd ~/proj/cmux-bisect
source ~/.config/cmux-bisect/env
DEMO=$(pwd)/tmp-demo/sort-bug
git -C $DEMO checkout -- .   # 데모 깨진 상태로 reset
clear
```

**polynomial 명령어 (붙여넣기 1줄, 발표 시작 직전)**:
```bash
npx tsx src/cli.ts bisect --good GOOD --bad BAD --repo $DEMO \
  --prompt "Fix src/sortlib.py so all unittest tests pass." \
  --oracle "python3 -m unittest discover tests/" \
  --trials 3 --max-turns 2
```

**라이브 데모 실패 시 폴백**: 영상 미리 녹화해서 `~/proj/cmux-bisect/demo.mp4` 두기. 무대에서 영상 재생하면서 같은 narrative.

---

## Submission form 체크리스트

| 필드 | 값 |
|---|---|
| Project name | cmux-bisect |
| One-line description | git bisect for AI agent decisions — localize the first bad tool call in log₂(N) trials |
| Track | 🛠 Developer Tooling (또는 🔴 AI Safety 백업) |
| GitHub URL | https://github.com/mrjunejeong/cmux-bisect |
| Demo URL | https://cmux-bisect.vercel.app *(Vercel import 후 확정)* |
| Team | (이름 + 이메일 입력) |
| Demo video | (Loom URL — 녹화 후 추가) |

---

## 리허설

**3회 권장**:
1. 1회: 시간만 측정 (60초 안 넘는지)
2. 2회: 거울/카메라 보면서 (눈맞춤 + 자세)
3. 3회: 누군가 앞에서 (질문 받기)

**Q1-Q4 답변 외워서 막힘없이 답하기**. 답이 너무 길어지지 않게 — 각 30초 이내.

---

## 만약 시간 부족하면 (60→30초 압축)

```
"AI 에이전트가 30분 task 결과 깨짐. 50 결정 중 어느 게 첫 잘못된 결정?
git bisect 알고리즘을 AI 결정 트리에 처음 적용.
[데모 5초만 — 답 #4]
Russ Cox 의 K-runs recipe 를 LLM 에 처음. $0.10/trial.
github.com/mrjunejeong/cmux-bisect"
```
