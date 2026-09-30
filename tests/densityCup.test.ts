import { describe, it, expect } from 'vitest';
import subs from '../public/data/substances.json';
import type { Substance } from '@/game/types';
import { layerOrder, flowRate, mixDelta, settle, labelCorrect, calcStars } from '@/game/minigames/densityCup';

const all = subs as Substance[];
const water = all.find(s => s.id === 'water')!;
const oil = all.find(s => s.id === 'cooking-oil')!;

describe('densityCup', () => {
  it('식용유가 위, 물이 아래', () => {
    const o = layerOrder([water, oil]);
    expect(o.map(s => s.id)).toEqual(['cooking-oil', 'water']);
    expect(labelCorrect('water', 1, o)).toBe(true);
    expect(labelCorrect('water', 0, o)).toBe(false);
  });
  it('천천히 붓기는 섞이지 않고 빠르면 섞인다', () => {
    expect(flowRate(10)).toBe(0);
    expect(flowRate(90)).toBeGreaterThan(flowRate(40));
    expect(mixDelta(flowRate(40), 1)).toBe(0);
    expect(mixDelta(flowRate(90), 1)).toBeGreaterThan(0.5);
    expect(settle(0.3, 1)).toBe(0);
  });
  it('별점', () => {
    expect(calcStars(0, 0.1)).toBe(3);
    expect(calcStars(1, 0.1)).toBe(2);
    expect(calcStars(2, 0.9)).toBe(1);
  });
});
