import { describe, it, expect } from 'vitest';
import subs from '../public/data/substances.json';
import type { Substance } from '@/game/types';
import { buildPieces, readError, identify, calcStars } from '@/game/minigames/densityBench';

const all = subs as Substance[];
const iron = all.find(s => s.id === 'iron')!;
const al = all.find(s => s.id === 'aluminum')!;

describe('densityBench', () => {
  it('조각 4개, 질량/부피가 물질 밀도와 일치', () => {
    const p = buildPieces([iron, al], [10, 20]);
    expect(p).toHaveLength(4);
    p.forEach(x => expect(x.mass / x.volume).toBeCloseTo(x.substance.density!, 5));
    expect(new Set(p.map(x => x.substance.id)).size).toBe(2);
    expect(p.filter(x => x.substance.id === 'iron').map(x => x.volume).sort()).toEqual([10, 20]);
  });
  it('눈높이 오차', () => {
    expect(readError(0.1)).toBe(0);
    expect(readError(1)).toBe(5);
    expect(readError(-1)).toBe(-5);
    expect(Math.abs(readError(0.5))).toBeGreaterThan(0);
  });
  it('물질 확정', () => {
    expect(identify(7.87, [iron, al])?.id).toBe('iron');
    expect(identify(2.7, [iron, al])?.id).toBe('aluminum');
    expect(identify(5, [iron, al])).toBeNull();
  });
  it('별점', () => {
    expect(calcStars(4, 4, 50, 75)).toBe(3);
    expect(calcStars(1, 4, 50, 75)).toBe(2);
    expect(calcStars(1, 4, 200, 75)).toBe(1);
  });
});
