# 미니게임 개발 공통 지침 (에이전트용)

프로젝트: `/Users/choijonghun/agent/snug-matter-properties-game/snug-matter-properties-game` (Next 16 + React 19 + Tailwind 4 + zustand, pnpm). 중2 과학 "물질의 특성" 수업용 게임. 학생 기기 크롬북 터치 1280×800.
읽을 것: `AGENTS.md`(과학 정확성·용어), `docs/superpowers/specs/2026-09-30-matter-properties-design.md` 5장(미니게임 스펙), `game/types.ts`, `game/minigameTypes.ts`(props 계약), `game/rules.ts`, `public/data/substances.json`. 참고 구현: `../../snug-rock-cycle-game/components/overlays/MineralOverlay.tsx`(포인터 드래그·문지르기 방식).

## 계약
- 파일 `components/minigames/<Name>.tsx` 에서 `export function <Name>(props)` (named export, 'use client'). props는 `game/minigameTypes.ts`의 `InvestigateProps` 또는 `SeparateProps`. 끝나면 `onDone({stars, purity?})`를 **정확히 한 번**(ref로 중복 방지). stars 0~3.
- 순수 판정 로직(정밀도→별, 석출량, 구간 판정 등)은 `game/minigames/<name>.ts` 에 함수로 빼고 `tests/<name>.test.ts` 로 vitest 테스트. 컴포넌트는 그 함수를 호출만 한다. 과학 수치는 `substances.json`의 값을 props(Substance)로 받아 쓴다. 하드코딩 금지(특히 밀도·끓는점·용해도).
- 수치(시간·허용 오차·속도)는 `props.config.<키> ?? 기본값`. `minigame-config.json`은 편집하지 않는다.
- 파일 소유 범위: 자기 컴포넌트·로직·테스트·`app/dev/<Name>/page.tsx` 하네스만 만들고 수정. 다른 사람 파일·`package.json`·공용 파일 수정 금지. 새 의존성 금지.
- 하네스 `app/dev/<Name>/page.tsx`: 'use client', `substances.json`을 fetch(`/data/substances.json`)해 props를 만들어 컴포넌트를 1280×800 박스에 띄우고 결과를 화면에 표시. dev 서버가 이미 `http://localhost:3300`에서 돌고 있다(건드리지 말 것). `curl -s -o /dev/null -w "%{http_code}" localhost:3300/dev/<Name>` 로 200 확인 + `/tmp/matter-dev.log`에서 컴파일 오류 확인. **브라우저 조작 도구는 다른 작업과 충돌하므로 쓰지 않는다.**

## 화면·조작 원칙 (필수)
- 루트: `<div className="absolute inset-0 pointer-events-auto ...">` 1280×800 네이티브 좌표. 배경은 불투명 그라데이션(뒤 화면이 비치지 않게).
- **이모지 금지.** 그림은 SVG·CSS 도형 + 이름표 텍스트. 물질 아이콘은 `<img src="/assets/items/<id>.webp" onError=숨김>` 시도 후 색 도형 대체(나중에 이미지가 들어옴, 없어도 완성돼야 함).
- 상시 텍스트 최소: 조작 대상·단추 이름표·수치 표시 위주. 안내는 한 줄. 긴 설명 금지. 한글 `word-break: keep-all`. 교과서 용어 그대로(밀도, 눈금실린더, 전자저울, 분별 깔때기, 석출, 재결정, 거름 장치, 증류, 끓임쪽…). 비중·여과·부력 금지.
- 조작은 과학 행동과 닮게: 옮기기·담그기·기울이기=**드래그**, 세기 조절=슬라이더/다이얼, 열기·가열=**길게 누르기**, 젓기=연타/문지르기. 단순 클릭 나열 금지. 드래그 잡는 영역은 넉넉히(터치), 놓을 자리는 눈에 띄게(점선·반짝임), 비언어 안내(화살표·움직이는 손 모양 도형·반짝임)로 첫 조작을 유도.
- **포인터 이벤트**(`onPointerDown/Move/Up`, `setPointerCapture`, `touch-action: none`)로 마우스·터치 모두 지원, 캔버스/영역 밖에서 손을 떼거나 `pointercancel`이어도 드래그·길게 누르기 해제. 모든 조작에 **키보드 대체 수단**(방향키·Space/Enter)을 둔다 (`e.repeat` 무시, 필요하면 keydown/keyup).
- 시작 후 0.7초 입력 잠금(연타로 넘어가는 것 방지). 끝난 뒤 자동 종료하지 말고 결과 한 줄 + "다음" 단추(Enter/Space 키 대체)로 `onDone` 호출 (단, 잠금 0.7초).
- 한 판 길이: 조사 30~60초, 분리 60~90초. 실패해도 막히지 않게 재시도 가능, 너무 어렵지 않게(중2, 처음 하는 학생이 설명 없이 성공 가능).
- 효과음: `import { playSfx } from '@/game/audio'` — `'correct' | 'error' | 'success'`.
- 표시 텍스트에 교과서에 없는 사실 금지. 모르면 넣지 않는다.

## 완료 기준
`pnpm typecheck && pnpm lint && pnpm test` 통과(전체가 아니라 최소 자기 변경으로 인한 오류 없음), 하네스 200. 마지막에 보고: 만든 파일, 조작 방법 요약, 별점 기준, 미해결 사항.
