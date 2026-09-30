import type { Substance } from '@/game/types';
import { solubilityAt } from '@/game/rules';

/** 병 속 물 10 g. 약숟가락 한 번에 1 g (0.5 g씩이면 질산 칼륨 60 ℃까지 22번이라 너무 길다). */
export const WATER_G = 10;
export const SCOOP_G = 1;
const EPS = 1e-6;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** 물 10 g에 최대로 녹는 양 (곡선은 물 100 g 기준이므로 ÷10) */
export const capacity = (s: Substance, t: number) => r2((solubilityAt(s, t) * WATER_G) / 100);

export interface Bottle {
  temp: 20 | 60;
  /** 녹은 양 */
  dissolved: number;
  /** 방금 넣어 아직 젓지 않은 가루 */
  pending: number;
  /** 젓고도 녹지 않아 바닥에 남은 가루 */
  settled: number;
}
export const newBottle = (): Bottle => ({ temp: 20, dissolved: 0, pending: 0, settled: 0 });

/** 가루가 이미 바닥에 남아 있는데 또 넣으면 낭비 */
export function addScoop(b: Bottle): { bottle: Bottle; wasted: boolean } {
  return { bottle: { ...b, pending: r2(b.pending + SCOOP_G) }, wasted: b.settled > EPS };
}

/** 젓기: 그 온도의 최대량까지 녹고 나머지는 바닥에 남는다. saturated = 더 안 녹음 */
export function stir(b: Bottle, s: Substance): { bottle: Bottle; saturated: boolean } {
  const all = b.pending + b.settled;
  const take = Math.min(all, Math.max(0, capacity(s, b.temp) - b.dissolved));
  const settled = r2(all - take);
  return { bottle: { ...b, dissolved: r2(b.dissolved + take), pending: 0, settled }, saturated: settled > EPS };
}

/** 60 ℃ 물 비커에 담그면 남은 가루가 녹는다 (더 안 녹으면 saturated) */
export const warm = (b: Bottle, s: Substance) => stir({ ...b, temp: 60 }, s);

export interface Record2 { r20?: number; r60?: number }

/** 온도에 따른 용해도 차(60 ℃ − 실온)가 가장 큰 물질 이름 */
export function biggestGain(items: { name: string; r20: number; r60: number }[]): string {
  return [...items].sort((a, b) => b.r60 - b.r20 - (a.r60 - a.r20))[0].name;
}

/** 별: 시간(초)과 낭비(녹지 않는데 계속 넣은 횟수) */
export function solubilityStars(seconds: number, waste: number, parSec = 100): 1 | 2 | 3 {
  if (waste <= 1 && seconds <= parSec) return 3;
  if (waste <= 3 && seconds <= parSec * 1.6) return 2;
  return 1;
}
