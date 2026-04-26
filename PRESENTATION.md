# PRESENTATION — 무대 위 외워서 말함

> 누구든 (git bisect 모르는 사람도) 60초에 이해되도록 작성. 한국어 우선.

---

## 60초 narrative (그대로 외움)

```
[화면: cmux-bisect.vercel.app, 4 agent 카드 보임]

"AI 코딩 도구 다 쓰시죠? Claude Code, Cursor, Copilot.
'이 버그 고쳐줘' 시키면 AI 가 30분 동안 일해요.
파일 읽고, 코드 쓰고, 테스트 돌리고...
그동안 50개 정도 결정을 합니다.

그런데 30분 후 보니 결과가 깨졌어요.
테스트 여전히 실패. 또는 AI 가 거짓말로 '다 됐다' 보고함.

질문: 50개 결정 중 어느 결정이 첫 번째로 잘못된 결정인가요?

지금 답하는 방법:
- 30분짜리 trace 처음부터 읽기 → 1시간
- 처음부터 다시 시키기 → 또 30분 + 비용
- 다른 AI 한테 묻기 → 추측, 검증 안 됨

저희 도구 cmux-bisect 는:
1-100 사이 숫자 맞추기 게임 아시죠?
'1이야? 2이야?' 가 아니라 '50보다 커?' 한 번에 절반 자르는 그것.
같은 원리를 AI 결정 50개에 적용했어요.

[화면: Agent D 카드의 'bisect this run' 버튼 클릭]

여기 Agent D 가 sort 버그 fix 시도했는데 실패. 6개 결정.

[애니메이션 진행 — round 1, 2, 3]

Round 1: 결정 #2 부터 다시 fork 해서 시도 → 통과.
Round 2: 결정 #4 부터 다시 시도 → 실패.
Round 3: 결정 #3 부터 → 통과.

3 라운드 만에 답: 결정 #4.
'AI 가 src/ 대신 tests/ 를 수정한 그 순간이 망친 시점.'

이 도구의 핵심:
- 추측 아니라 진짜 테스트 슈트로 검증
- AI 가 거짓말 했어도 실제 코드 다시 돌려서 catch
- 1시간 → 5분.

GitHub: github.com/mrjunejeong/cmux-bisect
Live demo: cmux-bisect.vercel.app
끝."
```

---

## 더 짧게 (30초)

```
"AI agent 가 30분 일해서 50개 결정 후 결과 깨졌어요.
어느 결정이 첫 번째로 잘못된 결정?
지금: 사람이 1시간 trace 읽음.

cmux-bisect 는 이분 탐색으로 자동 6번 fork → 답.
[demo] 결정 #4. AI 가 src 대신 tests 를 수정한 순간.
1시간 → 5분.

cmux-bisect.vercel.app"
```

---

## 5초 엘리베이터

> **"AI 가 30분 일하다 망쳤을 때, 50개 결정 중 어디서 망쳤는지 5분 안에 자동으로 찾아주는 도구."**

---

## Q&A 답변 (외워야 할 4개)

### Q: "그냥 다른 AI 한테 trace 던져서 '어디 잘못됐냐' 묻는 게 더 빠른 거 아닌가요?"
**A**:
> *"맞아요, 정직히 80% 케이스에서 그게 더 빠릅니다. 단 우리 도구가 우월한 narrow case 가 4가지:*
> 1. *AI 가 거짓말 의심될 때 — 우리는 실제 코드 다시 돌려서 검증*
> 2. *200개+ 결정 long trace — LLM judge 는 context window 한계*
> 3. *Compliance/audit — '의견' 이 아닌 결정론적 답 필요*
> 4. *CI 환경 — 사람이 매 PR 마다 복붙 못 함*
>
> *Generic tool 이 아닌 narrow tool 인 거 정직히 인정합니다."*

### Q: "AI 가 매번 다르게 행동하는데 fork 다시 시키면 결과 다르지 않나요?"
**A**:
> *"맞습니다. 그래서 매 시도마다 K=3 번 반복 + 다수결 (majority vote). 같은 fork 를 3번 다시 돌려서 2번 이상 같은 결과 나오면 신뢰. Russ Cox 가 이 방법 추천한 거 그대로 적용 — 비결정적 시스템에서 binary search 하는 표준 recipe."*

### Q: "잘 설정된 TDD agent 면 이거 필요 없는 거 아닌가요?"
**A**:
> *"맞아요. TDD 잘 따르는 agent + 좋은 테스트 슈트 = 우리 도구 가치 줄어듦. 단 현실은 agent 가 자주 TDD skip 하거나 test 자체를 cheat (예: 우리 데모 처럼 src 안 고치고 tests 를 수정). 그 케이스에서 우리가 진짜 코드 다시 실행 → AI 거짓말 catch."*

### Q: "Cursor 의 /rewind, Aider 의 /undo 도 비슷한 거 아닌가요?"
**A**:
> *"Aider /undo, Cursor /rewind 는 single-shot — 사람이 한 번 클릭. 50개 결정 중 어느 게 잘못됐는지 모르면 50번 클릭해야 함. 우리는 자동 binary search loop = 6번 자동. log₂(50) 효율."*

---

## 무대 setup checklist

**노트북 화면 split**:
- 왼쪽 ⅔: 브라우저 → `https://cmux-bisect.vercel.app` (animation 자동 재생)
- 오른쪽 ⅓: 터미널 (보조)

**미리 열어둘 탭**:
1. `cmux-bisect.vercel.app` (라이브 데모)
2. `github.com/mrjunejeong/cmux-bisect` (Q&A 시 코드 보여주기)

**무대 행동**:
1. 화면 켬 → 자동으로 4 agent 카드 + animated bisect 시작
2. narrative 시작
3. 30초 후쯤 Agent D 의 [bisect this run] 클릭 (애니메이션 reset + 강조)
4. 결과 카드 fade in 보면서 narrative 마무리
5. URLs 슬라이드 마지막 5초

**사고 대비**:
- wifi 끊기면? → 영상 폴백 (사전 녹화 권장, 60초 Loom)
- 페이지 안 뜨면? → GitHub README 의 quick start 그대로 보여줌
- Q&A 모르면? → "정직히 narrow case 인 거 인정" 으로 escape

---

## 무대 위 1줄 cheat

```
1. AI 망친 50 결정 중 어디서? → 1시간 → 5분 (10초)
2. 이분 탐색으로 자동 fork (15초)
3. [demo: 결정 #4 = src 대신 tests 수정한 순간] (30초)
4. cmux-bisect.vercel.app (5초)

Q&A 답: narrow tool 정직 / K-trials majority vote / TDD 인정 / 자동 loop
```

---

## Submission form 값

| 필드 | 값 |
|---|---|
| Project name | `cmux-bisect` |
| One-line description | `AI 가 30분 일한 후 결과가 깨졌을 때, 어느 결정이 첫 번째로 잘못된 결정인지 자동으로 찾아주는 도구. 이분 탐색으로 1시간을 5분으로.` |
| English description | `Find the first bad decision in a failed AI agent run via binary search. Cuts hour-long trace reading to 5 minutes.` |
| Track | 🛠 Developer Tooling |
| GitHub | https://github.com/mrjunejeong/cmux-bisect |
| Demo | https://cmux-bisect.vercel.app |
