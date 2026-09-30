# 물질 분리 공방 (가제) — snug-matter-properties-game

중2 과학 Ⅰ. 물질의 특성 학습 게임. 마을 "분리 공방"의 견습생이 되어 섞여 버린 것의 특성을 조사하고, 밀도 차·용해도 차·끓는점 차 중 무엇을 쓸지 골라 장치를 조작해 순물질을 꺼낸다. **현재 프로젝트 뼈대만 있음** (2026-09-30). 설계 스펙은 승인됨, 계획서 작성 후 구현 시작.

## 실행

```bash
pnpm install
pnpm dev          # http://localhost:3300
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## 문서

- 설계 스펙 (승인): `docs/superpowers/specs/2026-09-30-matter-properties-design.md`
- 가안·결정 기록: `docs/superpowers/specs/2026-09-30-matter-properties-draft.md`
- 교과서 발췌·정리: `docs/superpowers/specs/2026-09-30-matter-properties-textbook.md` (미래엔 과학2 Ⅰ. 물질의 특성 13~51쪽). 교과서 원문은 저장소에 두지 않는다.
- 계획서: 작성 예정 (`docs/superpowers/plans/*-mvp.md`)

## 구조 (스펙 9장)

암석 순환 여행(`snug-rock-cycle-game`)과 같은 구조를 따른다.

- Next.js 16 App Router 위에 Phaser 4 캔버스(1280×800, HiDPI)와 React 오버레이(HUD·대화·퀴즈·갈림길·실험대)를 겹친다.
- 분리 판정 규칙은 `game/rules.ts` 하나(`canSeparate`), 진행 상태는 zustand 스토어 `game/store.ts`(localStorage 이어하기).
- 편집 가능한 콘텐츠는 `public/data/*.json`(물질·의뢰·미니게임·대화·퀴즈), `/admin`에서 편집 (배포 서버는 저장 403).
- 그림은 `public/assets/`에 WebP를 넣으면 자동 사용, 없으면 플레이스홀더. 장치 그림은 SVG 코드 우선. 생성·변환 스크립트는 `scripts/`.
