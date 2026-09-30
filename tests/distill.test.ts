import { it, expect } from 'vitest';
import { bumps, correctTube, done, initDistill, purityOf, stepDistill, starsFromPurity, isBoiling } from '@/game/minigames/distill';

const bps = [78, 100];
/** 시험관을 지연 없이(또는 lag초 늦게) 바꾸며 끝까지 돌린다 */
function run(opts: { follow: boolean; ice: boolean; power?: number }) {
  let s = initDistill(2);
  for (let k = 0; k < 20000 && !done(s); k++) {
    if (opts.follow) s.tube = correctTube(s, bps);
    if (opts.ice && s.coolant > 0.7) s.coolant = 0;
    s = stepDistill(s, bps, opts.power ?? 0.6, 0.05);
  }
  return s;
}

it('온도는 끓는점에서 평평, 끝나면 소금이 남는 구간으로 더 오른다', () => {
  let s = initDistill(2);
  const seen = new Set<number>();
  for (let k = 0; k < 4000; k++) { s = stepDistill(s, bps, 0.6, 0.05); seen.add(Math.round(s.temp)); }
  expect(seen.has(78) && seen.has(100)).toBe(true);
  expect(s.temp).toBeGreaterThan(100);
});
it('시험관: 가 → 나(에탄올) → 다 → 라(물)', () => {
  let s = initDistill(2);
  const order: number[] = [];
  for (let k = 0; k < 4000 && !done(s); k++) {
    s = stepDistill(s, bps, 0.6, 0.05);
    const t = correctTube(s, bps);
    if (order[order.length - 1] !== t) order.push(t);
  }
  expect(order).toEqual([0, 1, 2, 3]);
  expect(isBoiling(initDistill(2), bps)).toBe(false);
});
it('제때 바꾸고 얼음을 보충하면 순도 높음 (3별)', () => {
  const s = run({ follow: true, ice: true });
  expect(purityOf(s)).toBeGreaterThan(0.95);
  expect(starsFromPurity(purityOf(s))).toBe(3);
});
it('시험관을 안 바꾸면 순도 0, 얼음을 놓치면 양이 줄어든다', () => {
  expect(purityOf(run({ follow: false, ice: true }))).toBe(0);
  const warm = run({ follow: true, ice: false });
  expect(warm.lost).toBeGreaterThan(0);
  expect(purityOf(warm)).toBeLessThan(purityOf(run({ follow: true, ice: true })));
});
it('끓임쪽을 빠뜨리면 첫 끓는점에서 끓어 넘친다', () => {
  let s = initDistill(2);
  while (!bumps(false, s, bps) && s.temp < 200) s = stepDistill(s, bps, 1, 0.05);
  expect(s.temp).toBe(78);
  expect(bumps(true, s, bps)).toBe(false);
});
