import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canSeparate, evaluateChoice, isUnlocked, missionStars, needsInvestigation, remainingBefore, runComplete } from '@/game/rules';
import type { Mission, Substance } from '@/game/types';

const load = <T,>(f: string) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8')) as T;
const subs = load<Substance[]>('substances');
const ms = load<Mission[]>('missions');
const m = (id: string) => ms.find(x => x.id === id)!;

describe('canSeparate (스펙 4-3 판정표)', () => {
  it('물+식용유: 밀도 차 가능(식용유 위층), 증류 불가(층)', () => {
    expect(canSeparate(['water', 'cooking-oil'], 'density', subs)).toMatchObject({ ok: true, target: ['cooking-oil'], remaining: ['water'] });
    expect(canSeparate(['water', 'cooking-oil'], 'boiling', subs).reasonKey).toBe('boiling-layer');
    expect(canSeparate(['water', 'cooking-oil'], 'solubility', subs).reasonKey).toBe('solubility-liquid');
  });
  it('물+에탄올: 밀도 차 불가(섞임), 증류 가능(에탄올 먼저)', () => {
    expect(canSeparate(['water', 'ethanol'], 'density', subs).reasonKey).toBe('miscible');
    expect(canSeparate(['water', 'ethanol'], 'boiling', subs)).toMatchObject({ ok: true, target: ['ethanol'] });
  });
  it('질산 칼륨+염화 나트륨: 재결정으로 질산 칼륨, 증류 불가', () => {
    expect(canSeparate(['kno3', 'nacl'], 'solubility', subs)).toMatchObject({ ok: true, target: ['kno3'] });
    expect(canSeparate(['kno3', 'nacl'], 'boiling', subs).reasonKey).toBe('boiling-solid');
    expect(canSeparate(['kno3', 'nacl'], 'density', subs).reasonKey).toBe('solid-needs-medium');
  });
  it('볍씨+쭉정이+소금물: 밀도 차로 쭉정이(뜸)', () => {
    expect(canSeparate(['rice', 'husk', 'saltwater'], 'density', subs)).toMatchObject({ ok: true, target: ['husk'] });
    expect(canSeparate(['rice', 'husk'], 'density', subs).reasonKey).toBe('solid-needs-medium');
  });
  it('최종: 소금만 남으면 재결정 불가', () => {
    expect(canSeparate(['nacl', 'water'], 'solubility', subs).reasonKey).toBe('solubility-single');
  });
});

describe('의뢰 데이터', () => {
  it('성분·얻는 물질이 물질 표에 있다', () => {
    for (const x of ms) for (const id of [...x.components, ...x.steps.flatMap(s => s.obtains)]) expect(subs.some(s => s.id === id), `${x.id}:${id}`).toBe(true);
  });
  it('모든 의뢰의 인정 순서가 규칙으로 실제 분리된다', () => {
    for (const x of ms) x.steps.forEach((st, i) => {
      const r = evaluateChoice(x, i, st.method, subs);
      expect(r.ok, `${x.id} step${i}: ${r.reasonKey}`).toBe(true);
      // 남는 것이 leaves와 일치
      const after = remainingBefore(x, i).filter(id => !st.obtains.includes(id));
      if (st.leaves) expect(after.sort()).toEqual([...st.leaves].sort());
    });
  });
  it('최종 의뢰: 증류를 먼저 고르면 층 안내, 재결정은 not-single', () => {
    const f = m('m4');
    expect(evaluateChoice(f, 0, 'boiling', subs).reasonKey).toBe('boiling-layer');
    expect(evaluateChoice(f, 0, 'solubility', subs).reasonKey).toBe('solubility-single');
    expect(evaluateChoice(f, 1, 'density', subs).reasonKey).toBe('miscible');
  });
  it('최종 의뢰 잠금: 필수 3개 완료 시 열림', () => {
    const f = m('m4');
    expect(isUnlocked(f, ['m1', 'm2'], ms)).toBe(false);
    expect(isUnlocked(f, ['m1', 'm2', 'm3'], ms)).toBe(true);
    expect(runComplete(['m1', 'm2', 'm3'], ms)).toBe(false);
    expect(runComplete(['m1', 'm2', 'm3', 'm4'], ms)).toBe(true);
  });
  it('도감 대조로 조사 생략', () => {
    expect(needsInvestigation(m('m1'), [])).toBe(true);
    expect(needsInvestigation(m('m1'), ['water', 'cooking-oil'])).toBe(false);
    expect(needsInvestigation(m('m4'), [])).toBe(true);
    expect(needsInvestigation(m('m4'), ['water', 'olive-oil'])).toBe(false);
  });
  it('별점 0~3', () => {
    expect(missionStars([3, 3], 0, true)).toBe(3);
    expect(missionStars([2], 1, false)).toBe(1);
    expect(missionStars([0], 1, false)).toBe(0);
  });
});
