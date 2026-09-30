import type { Substance } from '@/game/types';

/** 위→아래 층 순서: 밀도 작은 것이 위. 값이 없는 액체(식용유 등)는 "물보다 작다"이므로 가장 위. */
export function layerOrder(liquids: Substance[]): Substance[] {
  return [...liquids].sort((a, b) => (a.density ?? -Infinity) - (b.density ?? -Infinity));
}

/** 병 기울기(도) → 붓는 속도(컵 높이 비율/초). 15° 이하는 안 나온다. */
export function flowRate(tilt: number): number {
  return Math.min(1, Math.max(0, (tilt - 15) / 75)) * 0.55;
}

/** 빠르게 부으면(gentle 초과) 뿌옇게 섞인 정도가 는다. */
export function mixDelta(rate: number, dt: number, gentle = 0.25, k = 3): number {
  return rate > gentle ? (rate - gentle) * dt * k : 0;
}

/** 가만히 두면 가라앉으며 맑아진다. */
export function settle(mix: number, dt: number, speed = 0.5): number {
  return Math.max(0, mix - speed * dt);
}

/** 이름표가 맞는 층에 붙었는가 (층 index는 위=0) */
export function labelCorrect(liquidId: string, layerIndex: number, order: Substance[]): boolean {
  return order[layerIndex]?.id === liquidId;
}

/** 별점: 끝까지 붙이면 1 + 이름표 오답 없음 +1 + 섞임 최고치가 mixTol 미만 +1 */
export function calcStars(wrong: number, peakMix: number, mixTol = 0.3): 0 | 1 | 2 | 3 {
  return (1 + (wrong === 0 ? 1 : 0) + (peakMix < mixTol ? 1 : 0)) as 1 | 2 | 3;
}
