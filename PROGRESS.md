# 물질 분리 공방 (가제) — 진행 기록

## 2026-09-30 기획·스펙
- 교과서 Ⅰ. 물질의 특성(13~51쪽) 발췌·정리 → `docs/superpowers/specs/2026-09-30-matter-properties-textbook.md` (단원 구조, 과학적 정확성, 수치표, 퀴즈 원천 33문항, 조작 단서 8개).
- 가안 → 설계 스펙 v1 **승인** (`2026-09-30-matter-properties-design.md`). 확정: 공방 견습생 세계관, 조사 미니게임 3종 모두(밀도 측정대·용해도 병·가열 곡선), 한 판 = 튜토리얼 + 필수 의뢰 3 + 최종 의뢰(12분 내외, 최대 15분), 오답은 교과서 근거 안내 후 재선택(별 1개 감점), 볍씨 의뢰는 선택.

## 2026-09-30 프로젝트 뼈대
- `snug-electricity-game` 뼈대와 동일 설정 (암석 순환에서 유래): pnpm 10, Next.js 16.3.6, React 19.2.8, Phaser 4.2, zustand 5, Tailwind 4, TypeScript 5, Vitest 4 (jsdom). dev 포트 3300 (혈액 3000, 암석 3100, 전기 3200과 동시 실행 가능).
- `app/page.tsx`는 1280×800 letterbox placeholder, `game/config.ts`는 무대 크기만. 게임 본체 없음.
- `scripts/` 3개 복사 (Codex 이미지 생성, WebP 배경 변환, 시트 자르기).
- 확인: `pnpm test`(3 tests) · `pnpm typecheck` · `pnpm lint` · `pnpm build`(정적 `/`) 모두 통과.

### 다음 단계
1. 계획서 `docs/superpowers/plans/2026-09-30-matter-properties-mvp.md` 작성 (스펙 9장 코드 구성 기준, 태스크별 체크박스).
2. 암석 순환에서 공통 부품 이식 (AGENTS.md "참고 구현" 목록) → `rules.ts`(4-3 판정표)와 테스트부터.
3. Vercel 대시보드에서 Import → main 푸시 자동 배포.

## 2026-09-30 MVP 1차 (자동 진행)
- 구조 결정: 미니게임 8개 전부 **React 오버레이(SVG·DOM)** 로 구현 (Phaser 씬 없음). Phaser 의존성은 남아 있으나 아직 쓰지 않음.
- 핵심: `game/rules.ts`(canSeparate·의뢰 잠금·별점), `game/store.ts`(단계 전이·저장), `game/dex.ts`(누적 도감), `public/data/*.json`(물질·의뢰·대화·퀴즈). `tests/rules.test.ts`, `tests/store.test.ts`.
- 미니게임 `components/minigames/*` (조사 4: DensityBench·DensityCup·SolubilityBottle·HeatingCurve / 분리 4: Funnel·Recrystal·Distill·FloatSieve), 순수 판정은 `game/minigames/*.ts`+테스트. 개발용 단독 페이지 `app/dev/<Name>`.
- 그림: Codex로 배경 2·NPC 시트·아이템 시트 생성 → `docs/assets-source/`, 게임용 `public/assets/{bg,npc,items}`. 목록은 `docs/art-todo.md`.
- 미구현: `/admin` 편집기, 사례 카드 9장·자료실, 효과음 추가, 선택 의뢰 외 추가 의뢰.

### QA 메모 (2026-09-30, 브라우저 1024×768 창에서 letterbox로 확인)
- 실제 조작으로 확인: 타이틀→인트로→튜토리얼(밀도 측정대)→퀴즈→의뢰판, 밀도 컵(기울여 붓기·이름표 드래그), 분별 깔때기, 용해도 병, 재결정(가열·냉각·거름·씻기), 가열 곡선, 증류(시험관 교체), 갈림길 오답 안내, 요약 화면. 새로고침 복원(진행 중 미니게임은 갈림길로 복귀).
- 확인 못 한 것: 소금물에 띄우기(FloatSieve) 완주, 크롬북 터치, 플레이 시간 실측(예상 12~14분), 최종 의뢰 처음부터 끝까지 한 번에.
- 조정: 용해도 병 약숟가락 0.5 g→1 g (질산 칼륨 60 ℃까지 22번 → 11번), 눈높이 허용 폭 0.15→0.3, 실행 중 HUD 숨김(조사·분리 화면).
- 알려진 아쉬움: 장치 그림은 SVG 도형(Codex 그림 아님), NPC는 정사각 초상만, 효과음 3종뿐, 미니게임 화면 어두운 단색 배경. 피드백 후 그림 교체 예정.
