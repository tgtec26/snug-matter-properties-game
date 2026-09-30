import { it, expect } from 'vitest';
import { curveTemp, judgeTap, reachTime, starsFromError } from '@/game/minigames/heatingCurve';

it('끓는점까지 오른 뒤 평평하고, 양이 많으면 늦게 닿지만 같은 온도', () => {
  expect(curveTemp(0, 100, 50)).toBe(20);
  expect(curveTemp(reachTime(100, 50), 100, 50)).toBe(100);
  expect(curveTemp(99, 100, 50)).toBe(100);
  expect(reachTime(100, 100)).toBeGreaterThan(reachTime(100, 50));
  expect(curveTemp(reachTime(78, 100) + 1, 78, 100)).toBe(78);
});
it('상승 구간은 단조 증가', () => {
  let p = 0;
  for (let t = 0; t <= 4; t += 0.2) { const v = curveTemp(t, 100, 50); expect(v).toBeGreaterThanOrEqual(p); p = v; }
});
it('평평해진 직후는 오차 0, 너무 이르거나 늦으면 오차 큼', () => {
  const tr = reachTime(100, 50);
  expect(judgeTap(tr + 0.3, 100, 50).error).toBe(0);
  expect(judgeTap(tr * 0.5, 100, 50).error).toBeGreaterThan(12);
  const late = judgeTap(tr + 5, 100, 50);
  expect(late.late).toBe(true);
  expect(late.error).toBeGreaterThan(12);
});
it('별점 경계', () => {
  expect([0, 2, 3, 5, 6, 12, 13].map((e) => starsFromError(e))).toEqual([3, 3, 2, 2, 1, 1, 0]);
});
