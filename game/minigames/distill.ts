/** 증류 시뮬레이션·판정 (순수 함수). 끓는점 낮은 순으로 하나씩 끓어 나오고, 그동안 온도는 일정하다. */
export interface DistillCfg {
  startTemp: number;
  /** 가열 세기 1일 때 초당 온도 상승(℃/s) */
  maxRate: number;
  /** 가열 세기 1일 때 초당 증류되는 양 */
  distillRate: number;
  /** 성분마다 처음 들어 있는 양 */
  volume: number;
  /** 냉각수가 데워지는 속도(가열 세기 1일 때 초당, 끓는 동안만) */
  heatUp: number;
  /** 이 값을 넘으면 미지근 */
  warmAt: number;
  /** 미지근할 때 액체로 받아지는 비율 */
  warmEff: number;
}
export const DISTILL_DEFAULTS: DistillCfg = {
  startTemp: 20, maxRate: 6, distillRate: 12, volume: 100, heatUp: 0.3, warmAt: 1, warmEff: 0.4,
};

export interface DistillState {
  temp: number;
  /** 성분별 남은 양 (끓는점 낮은 순) */
  remaining: number[];
  coolant: number;
  /** 지금 받고 있는 시험관 번호 (0=가) */
  tube: number;
  /** collected[시험관][성분] */
  collected: number[][];
  lost: number;
}

export function initDistill(n: number, c: DistillCfg = DISTILL_DEFAULTS): DistillState {
  return {
    temp: c.startTemp, remaining: Array(n).fill(c.volume), coolant: 0, tube: 0,
    collected: Array.from({ length: 2 * n }, () => Array(n).fill(0)), lost: 0,
  };
}

/** 끓임쪽 없이 첫 끓는점에 닿으면 끓어 넘친다 */
export function bumps(hasChip: boolean, s: DistillState, bps: number[]): boolean {
  return !hasChip && s.remaining.length > 0 && s.temp >= bps[0];
}

export const isBoiling = (s: DistillState, bps: number[]): boolean => {
  const i = s.remaining.findIndex((v) => v > 0);
  return i >= 0 && s.temp >= bps[i];
};

/** 지금 상태에서 맞는 시험관: 평평 구간 i → 2i+1, 그 사이 오르는 구간 → 2i (가·다…), 끝나면 마지막 */
export function correctTube(s: DistillState, bps: number[]): number {
  const i = s.remaining.findIndex((v) => v > 0);
  if (i < 0) return 2 * bps.length - 1;
  return s.temp >= bps[i] ? 2 * i + 1 : 2 * i;
}

export function stepDistill(s: DistillState, bps: number[], power: number, dt: number, c: DistillCfg = DISTILL_DEFAULTS): DistillState {
  const n = { ...s, remaining: [...s.remaining], collected: s.collected.map((r) => [...r]) };
  const i = n.remaining.findIndex((v) => v > 0);
  const dT = c.maxRate * power * dt;
  if (i < 0) { n.temp = Math.min(n.temp + dT, bps[bps.length - 1] + 30); return n; }
  if (n.temp < bps[i]) { n.temp = Math.min(n.temp + dT, bps[i]); return n; }
  n.temp = bps[i];
  const flux = Math.min(n.remaining[i], c.distillRate * power * dt);
  n.remaining[i] -= flux;
  const eff = n.coolant > c.warmAt ? c.warmEff : 1;
  n.collected[n.tube][i] += flux * eff;
  n.lost += flux * (1 - eff);
  n.coolant += c.heatUp * power * dt;
  return n;
}

export const done = (s: DistillState): boolean => s.remaining.every((v) => v <= 0);

/** 성분 i가 자기 평평 구간의 시험관(2i+1)에 받아진 양 / 전체 양 */
export function purityOf(s: DistillState, c: DistillCfg = DISTILL_DEFAULTS): number {
  const n = s.remaining.length;
  let ok = 0;
  for (let i = 0; i < n; i++) ok += s.collected[2 * i + 1][i];
  return ok / (n * c.volume);
}

export function starsFromPurity(p: number, t = { s3: 0.85, s2: 0.65, s1: 0.4 }): 0 | 1 | 2 | 3 {
  return p >= t.s3 ? 3 : p >= t.s2 ? 2 : p >= t.s1 ? 1 : 0;
}
