import { describe, it, expect } from 'vitest';
import subs from '../public/data/substances.json';
import type { Substance } from '@/game/types';
import { addScoop, capacity, newBottle, stir, warm, biggestGain, solubilityStars } from '@/game/minigames/solubilityBottle';

const S = subs as unknown as Substance[];
const kno3 = S.find(s => s.id === 'kno3')!;
const nacl = S.find(s => s.id === 'nacl')!;

function fill(s: Substance, n: number) {
  let b = newBottle();
  for (let i = 0; i < n; i++) b = addScoop(b).bottle;
  return stir(b, s);
}

describe('용해도 병', () => {
  it('최대량 = 곡선 값 ÷ 10', () => {
    expect(capacity(kno3, 20)).toBe(3.2);
    expect(capacity(kno3, 60)).toBe(11);
    expect(capacity(nacl, 20)).toBe(3.6);
  });
  it('질산 칼륨 3 g(3번)은 실온에서 다 녹고, 4 g(4번)은 남는다', () => {
    expect(fill(kno3, 3).saturated).toBe(false);
    const r = fill(kno3, 4);
    expect(r.saturated).toBe(true);
    expect(r.bottle.settled).toBeCloseTo(0.8);
  });
  it('60 ℃에 담그면 남은 가루가 녹는다', () => {
    const w = warm(fill(kno3, 4).bottle, kno3);
    expect(w.saturated).toBe(false);
    expect(w.bottle.dissolved).toBeCloseTo(4);
  });
  it('염화 나트륨은 60 ℃에서도 거의 더 안 녹는다', () => {
    const w = warm(fill(nacl, 5).bottle, nacl); // 5 g
    expect(w.saturated).toBe(true);
    expect(w.bottle.dissolved).toBeCloseTo(3.7);
  });
  it('바닥에 가루가 있는데 넣으면 낭비', () => {
    expect(addScoop(fill(kno3, 4).bottle).wasted).toBe(true);
    expect(addScoop(newBottle()).wasted).toBe(false);
  });
  it('용해도 차가 큰 물질', () => {
    expect(biggestGain([{ name: 'A', r20: 3.2, r60: 11 }, { name: 'B', r20: 3.6, r60: 3.7 }])).toBe('A');
  });
  it('별', () => {
    expect(solubilityStars(60, 0)).toBe(3);
    expect(solubilityStars(60, 3)).toBe(2);
    expect(solubilityStars(300, 9)).toBe(1);
  });
});
