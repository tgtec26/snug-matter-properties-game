import type { Substance } from '@/game/types';

export interface Piece { id: string; label: string; substance: Substance; volume: number; mass: number }

/** 조각 4개: 물질마다 크기 다른 큰·작은 조각. 질량은 substances의 밀도에서 역산 (밀도 × 부피). */
export function buildPieces(targets: Substance[], volumes: number[]): Piece[] {
  const out: Piece[] = [];
  volumes.forEach((v, vi) => {
    for (let k = 0; k < targets.length; k++) {
      const s = targets[(k + vi) % targets.length];
      out.push({ id: `${s.id}-${v}`, label: String.fromCharCode(65 + out.length), substance: s, volume: v, mass: (s.density ?? 0) * v });
    }
  });
  return out;
}

/** 눈높이 어긋남(0=수면과 일치, ±1=최대) → 읽는 값 오차(mL). 허용 범위 안이면 정확히 읽힌다. */
export function readError(offset: number, tol = 0.15, maxErr = 5): number {
  const a = Math.min(1, Math.abs(offset));
  if (a <= tol) return 0;
  return Math.sign(offset) * ((a - tol) / (1 - tol)) * maxErr;
}

export const isSharp = (offset: number, tol = 0.15) => Math.abs(offset) <= tol;

/** 계산한 밀도와 가장 가까운 물질. 표 Ⅰ-1 값과 상대 오차가 relTol 이내일 때만 확정한다. */
export function identify(density: number, targets: Substance[], relTol = 0.12): Substance | null {
  let best: Substance | null = null;
  let bestDiff = Infinity;
  for (const s of targets) {
    if (s.density === null) continue;
    const d = Math.abs(density - s.density) / s.density;
    if (d < bestDiff) { bestDiff = d; best = s; }
  }
  return best && bestDiff <= relTol ? best : null;
}

/** 별점: 끝까지 재면 1 + 눈금을 선명하게 읽은 비율 0.75 이상이면 +1 + 빠르면 +1 */
export function calcStars(sharpReads: number, totalReads: number, seconds: number, fastSec: number): 0 | 1 | 2 | 3 {
  let s = 1;
  if (totalReads > 0 && sharpReads / totalReads >= 0.75) s++;
  if (seconds <= fastSec) s++;
  return s as 1 | 2 | 3;
}
