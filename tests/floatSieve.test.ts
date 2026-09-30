import { describe, expect, it } from 'vitest';
import substances from '@/public/data/substances.json';
import type { Substance } from '@/game/types';
import { SIEVE_DEFAULTS as D, inSieve, judgeSieve, makeGrains } from '@/game/minigames/floatSieve';

const S = substances as Substance[];
const get = (id: string) => S.find((s) => s.id === id)!;
const grains = makeGrains([get('rice'), get('husk'), get('saltwater')], [get('husk')], D);

describe('floatSieve', () => {
  it('낟알 수와 뜸/가라앉음 구분', () => {
    expect(grains).toHaveLength(D.huskCount + D.riceCount);
    expect(grains.filter((g) => g.floats)).toHaveLength(D.huskCount);
    expect(grains.filter((g) => g.floats).every((g) => g.wanted && g.substanceId === 'husk')).toBe(true);
    expect(grains.filter((g) => !g.floats).every((g) => !g.wanted)).toBe(true);
  });
  it('쭉정이만 전부 걷으면 3별', () => {
    const r = judgeSieve(grains.filter((g) => g.wanted), grains, D);
    expect(r.stars).toBe(3); expect(r.purity).toBe(1);
  });
  it('볍씨를 함께 걷으면 감점', () => {
    const w = grains.filter((g) => g.wanted), rice = grains.filter((g) => !g.wanted);
    expect(judgeSieve([...w, rice[0]], grains, D).stars).toBe(2);
    expect(judgeSieve([...w.slice(0, 2), ...rice.slice(0, 2)], grains, D).stars).toBe(0);
  });
  it('아무것도 안 걷으면 0별', () => { expect(judgeSieve([], grains, D).stars).toBe(0); });
  it('체 범위 판정', () => { expect(inSieve(0, 0, 30, 0, 46)).toBe(true); expect(inSieve(0, 0, 50, 0, 46)).toBe(false); });
});
