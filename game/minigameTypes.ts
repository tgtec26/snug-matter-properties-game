import type { Method, MinigameResult, Substance } from '@/game/types';

/** 조사 미니게임 공통 props. 끝나면 onDone을 정확히 한 번 호출한다. */
export interface InvestigateProps {
  /** 조사할 물질 (missions.json investigate.targets) */
  targets: Substance[];
  /** minigame-config.json 자기 섹션 (없으면 {}) — 값이 없으면 컴포넌트 기본값 */
  config: Record<string, number>;
  onDone: (r: MinigameResult) => void;
}

/** 분리 미니게임 공통 props. */
export interface SeparateProps {
  method: Method;
  /** 이번 단계 시작 시점의 혼합물 성분 */
  mixture: Substance[];
  /** 이 단계에서 얻는 물질 (순서대로, 증류는 끓는점 낮은 순) */
  obtains: Substance[];
  /** 단계 끝에 남는 것 */
  leaves: Substance[];
  /** 최종 의뢰의 증류처럼 소금이 남는 연출이 필요하면 true */
  saltRemains: boolean;
  config: Record<string, number>;
  onDone: (r: MinigameResult) => void;
}
