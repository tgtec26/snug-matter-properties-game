/** 가열 곡선 판정 (순수 함수). 온도는 끓는점에 가까워질수록 완만해지다가 끓는점에서 평평해진다. */
export interface CurveCfg {
  startTemp: number;
  /** 물질 50 mL 기준 초당 상승 폭(℃/s). 양이 많으면 느려진다 */
  baseRate: number;
  /** 평평해진 뒤 "늦었다"고 보기 전까지 여유(초) */
  grace: number;
  /** 여유를 넘긴 뒤 초당 늘어나는 오차(℃) */
  lateRate: number;
}
export const CURVE_DEFAULTS: CurveCfg = { startTemp: 20, baseRate: 20, grace: 1, lateRate: 4 };

/** 끓는점에 처음 닿는 시각(초) */
export function reachTime(bp: number, amount: number, c: CurveCfg = CURVE_DEFAULTS): number {
  return ((bp - c.startTemp) / c.baseRate) * (amount / 50);
}

/** t초 뒤 온도: 상승 구간(위로 볼록) → 끓는점에서 평평 */
export function curveTemp(t: number, bp: number, amount: number, c: CurveCfg = CURVE_DEFAULTS): number {
  const tr = reachTime(bp, amount, c);
  if (t >= tr) return bp;
  const u = Math.max(0, t) / tr;
  return c.startTemp + (bp - c.startTemp) * (1 - (1 - u) * (1 - u));
}

/** 타이밍 탭 판정. 이르면 그 순간의 온도가 기록되고, 늦으면 끓는점 그대로지만 오차가 붙는다 */
export function judgeTap(t: number, bp: number, amount: number, c: CurveCfg = CURVE_DEFAULTS) {
  const tr = reachTime(bp, amount, c);
  if (t < tr) {
    const temp = curveTemp(t, bp, amount, c);
    return { temp, error: bp - temp, late: false };
  }
  return { temp: bp, error: Math.max(0, t - tr - c.grace) * c.lateRate, late: t - tr > c.grace };
}

export function starsFromError(err: number, c: { s3: number; s2: number; s1: number } = { s3: 2, s2: 5, s1: 12 }): 0 | 1 | 2 | 3 {
  return err <= c.s3 ? 3 : err <= c.s2 ? 2 : err <= c.s1 ? 1 : 0;
}
