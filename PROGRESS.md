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
