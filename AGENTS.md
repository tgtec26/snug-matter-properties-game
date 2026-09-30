# AGENTS

> AI 코딩 에이전트가 이 저장소에서 작업할 때 따라야 할 지침. 상위 `../../AGENTS.md`(워크스페이스 공통 규칙)가 있으면 병합해 적용한다.

## 현재 상태 (2026-09-30)
뼈대 + 승인된 설계 스펙. **계획서는 아직 없다.** `docs/superpowers/plans/<날짜>-matter-properties-mvp.md`를 스펙 9장 기준으로 만든 뒤 태스크별로 구현한다 (superpowers:writing-plans → subagent-driven-development).

## 작업을 이어받으면
1. [PROGRESS.md](PROGRESS.md)에서 완료 항목·다음 단계 확인.
2. 스펙 [docs/superpowers/specs/2026-09-30-matter-properties-design.md](docs/superpowers/specs/2026-09-30-matter-properties-design.md) (승인). 결정 과정은 가안 `*-draft.md`, 교과서 근거는 `*-textbook.md` (미래엔 과학2 Ⅰ. 물질의 특성 13~51쪽). 교과서 원문은 구글 드라이브에 있고 저장소에 커밋하지 않는다.
3. 참고 구현: 암석 순환 여행 — 로컬 `../snug-rock-cycle-game`, GitHub `tgtec26/snug-rock-cycle-game`. 옮겨 올 공통 부품: `game/systems/`(render, placeholders, sceneRouter, validators), `game/dataStore.ts`, `game/phaserConfig.ts`, `game/audio.ts`, `components/`(GameContainer, HUD, UIOverlay, TopControls, AudioRunner, overlays/DialogBox, overlays/QuizOverlay), `components/overlays/MineralOverlay.tsx`의 포인터·문지르기·드롭 판정(조사·분별 깔때기 오버레이의 바탕), `app/admin/`, `app/api/admin/`. 규칙·스토어·타입·씬·데이터·나머지 오버레이는 새로 쓴다. 그림 원본과 `public/assets`는 가져오지 않는다.
4. 코드 수정 후 `pnpm test && pnpm typecheck && pnpm lint` 통과. Next.js 16 API는 `node_modules/next/dist/docs/` 먼저 읽기.
5. 분리 판정 규칙은 `game/rules.ts`에만 (`canSeparate` — 스펙 4-3 표가 곧 테스트). 상태 전이는 `game/store.ts`의 `start/next/acceptMission/finishInvestigation/chooseMethod/completeMinigame/finishQuiz/restartRun/reset`만 사용 (임의 phase 점프 금지).
6. 편집 가능한 콘텐츠는 TS가 아니라 `public/data/*.json` (물질·의뢰·미니게임·대화·퀴즈). `/admin`에서 편집 (배포 서버는 저장 403).
7. `game/scenes/*.ts` 수정 후 브라우저 **전체 새로고침**. 개발 콘솔 훅: `__store`, `__game`, `__rules`.
8. 한글 UI는 어절 단위 줄바꿈(`word-break: keep-all`, 전역 CSS) 유지. 크롬북 1280×800 터치로 끝까지 진행 가능해야 한다. dev 포트 3300.

## 학습 핵심
"물질의 특성은 양에 관계없이 물질마다 정해져 있다. 특성으로 물질을 알아내고, 특성의 차이로 섞인 것을 가른다." 조사 결과 = 쓸 방법의 근거, 방법 선택 = 무엇이 먼저 분리되는가, 조작 결과 = 순도.

## 과학적 정확성 (반드시 유지) — 미래엔 과학2 Ⅰ. 물질의 특성 (16~45쪽)
- **물질의 특성** = 다른 물질과 구별되는 고유한 성질, **양에 관계없이 일정**. 밀도·용해도·녹는점·끓는점. **질량·부피는 특성이 아님** (29쪽).
- **밀도 = 질량/부피** (g/mL, g/cm³, 1 mL = 1 cm³). 작은 것이 큰 것 위로 뜬다. 값은 표 Ⅰ-1(18쪽)만: 에탄올 0.79, 물 1.00, 알루미늄 2.70, 철 7.87, 수은 13.60, 금 19.32. 식용유·올리브유는 값이 없으므로 "물보다 작고 에탄올보다 크다"만.
- **용해도** = 어떤 온도에서 **용매 100 g에 최대로 녹을 수 있는 용질의 질량(g)**. 대부분 고체는 온도↑ 용해도↑. 기체는 온도↑·압력↓ 용해도↓. 곡선 값은 교과서 그래프 축만 있으므로 모양(질산 칼륨 가파름, 염화 나트륨 평평)을 지키고 값은 `substances.json`에서 조정.
- **녹는점·끓는점** = 일정한 압력에서 상태가 변할 때 **일정하게 유지되는 온도**. 양이 달라도 같다. 끓는점은 압력↑이면↑. 에탄올 78 ℃, 물 100 ℃.
- **순물질·혼합물**: 한 종류 / 두 가지 이상의 순물질. 혼합물은 특성이 일정하지 않다 (소금물 끓는점, 33쪽).
- **밀도 차 분리**: 고체는 녹이지 않고 밀도가 중간인 액체에(볍씨·소금물). 서로 **섞이지 않는** 액체만 **분별 깔때기** — 아래층 꼭지, 경계면 따로, 위층 입구 (35쪽).
- **재결정**: 고체 혼합물을 용매에 **모두 녹인 뒤 온도를 낮추거나 용매를 증발**시켜 순수한 고체를 얻음. 용해도 차가 **큰** 물질이 **석출**, 거름 장치로 거름 (37쪽).
- **증류**: 끓는점 차. 가열해 나온 기체를 냉각. **끓는점 낮은 것이 먼저**. 온도 일정 구간이 성분 수만큼. 끓임쪽. 한 번으로는 순수하기 어려움 (38~40쪽).
- **용어**: 비중 X(밀도), 여과 X(거름), 부력 X("밀도 차로 뜨고 가라앉는다"), 농도·크로마토그래피·승화 분리·증기 압력 X(교과서 없음). "밀도 차·용해도 차·끓는점 차", "분별 깔때기", "석출", "재결정", "증류", "끓임쪽". 교과서에 없는 물질·수치는 **지어내지 않는다**.
