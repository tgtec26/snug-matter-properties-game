import { describe, it, expect } from 'vitest';
import subs from '../public/data/substances.json';
import type { Substance } from '@/game/types';
import { defaultCfg, initSim, step, allDissolved, filterResult, recrystalStars, cooledEnough, pointG, type Input, type Sim } from '@/game/minigames/recrystal';

const S = subs as unknown as Substance[];
const mix = [S.find(s => s.id === 'kno3')!, S.find(s => s.id === 'nacl')!];
const cfg = defaultCfg();
const run = (sim: Sim, sec: number, inp: Partial<Input>) => {
  for (let t = 0; t < sec; t += 0.05) sim = step(sim, 0.05, { heating: false, cooling: false, stir: 0, ...inp }, mix, cfg);
  return sim;
};

describe('재결정', () => {
  it('가열 + 젓기로 모두 녹는다', () => {
    const s = run(initSim([10, 2]), 12, { heating: true, stir: 1 });
    expect(s.temp).toBeGreaterThan(56);
    expect(allDissolved(s)).toBe(true);
  });
  it('가열 안 하면 질산 칼륨은 안 녹는다 (20 ℃ 곡선 32 g/100 g)', () => {
    const s = run(initSim([10, 2]), 10, { stir: 1 });
    expect(allDissolved(s)).toBe(false);
    expect(s.dissolved[0]).toBeCloseTo(3.2);
  });
  it('다 녹인 뒤 냉각: 질산 칼륨만 석출, 염화 나트륨은 용액', () => {
    let s = run(initSim([10, 2]), 12, { heating: true, stir: 1 });
    s = run(s, 8, { cooling: true });
    expect(cooledEnough(s, cfg)).toBe(true);
    expect(s.crystal[0]).toBeGreaterThan(7);
    expect(s.crystal[1]).toBe(0);
    expect(pointG(s, 1, cfg)).toBeCloseTo(20);
    const wet = filterResult(s, 0, 0, cfg), washed = filterResult(s, 0, 1, cfg);
    expect(wet.purity).toBeGreaterThan(0.9);
    expect(washed.purity).toBe(1);
    expect(recrystalStars(wet)).toBe(2);
    expect(recrystalStars(washed)).toBe(3);
  });
  it('다 녹기 전에 냉각하면 순도 하락', () => {
    let s = run(initSim([10, 2]), 1, { heating: true }); // 젓지 않아 염화 나트륨이 덜 녹음
    s = run(s, 8, { cooling: true });
    const r = filterResult(s, 0, 1, cfg);
    expect(r.otherOnPaperG).toBeGreaterThan(0.5);
    expect(r.purity).toBeLessThan(0.9);
  });
});
